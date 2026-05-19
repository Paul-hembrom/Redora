import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import mammoth from 'mammoth';
import ePub from 'epubjs';
import { PreprocessOptions, Chapter } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { generateChapterMetadata, generateBatchChapterMetadata, extractTextFromImage, ApiRateLimitError, generateDocumentHierarchy } from './gemini';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;
}

const STOP_WORDS = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 'into', 'is', 'it', 'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the', 'their', 'then', 'there', 'these', 'they', 'this', 'to', 'was', 'will', 'with']);

function simpleStemmer(word: string): string {
  return word.replace(/(ing|ly|ed|ious|ies|ive|es|s|ment)$/i, '');
}

export function preprocessText(text: string, options: PreprocessOptions): string {
  if (!options.removeStopWords && !options.applyStemming) return text;
  
  let words = text.split(/\s+/);
  
  if (options.removeStopWords) {
    words = words.filter(w => !STOP_WORDS.has(w.toLowerCase()));
  }
  
  if (options.applyStemming) {
    words = words.map(w => simpleStemmer(w));
  }
  
  return words.join(' ');
}

export async function extractTextFromFile(file: File, onProgress?: (msg: string) => void): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  if (extension === 'txt') {
    return new TextDecoder().decode(arrayBuffer);
  }

  if (extension === 'epub') {
    if (onProgress) onProgress('Parsing EPUB...');
    const book = ePub(arrayBuffer);
    await book.ready;
    let text = '';
    const spine = book.spine as any;
    for (let i = 0; i < spine.length; i++) {
      if (onProgress) onProgress(`Extracting EPUB chapter ${i + 1} of ${spine.length}...`);
      const item = spine.get(i);
      const doc = await book.load(item.href);
      if (doc && (doc as any).body) {
        text += (doc as any).body.textContent + '\n\n';
      }
    }
    return text;
  }

  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (['jpg', 'jpeg', 'png', 'webp'].includes(extension || '')) {
    if (onProgress) onProgress('Extracting text from image using AI...');
    const base64Data = btoa(
      new Uint8Array(arrayBuffer)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    const mimeType = file.type || `image/${extension === 'jpg' ? 'jpeg' : extension}`;
    return await extractTextFromImage(base64Data, mimeType);
  }

  if (extension === 'pdf') {
    const extractPdf = async (workerSrc?: string) => {
      if (workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
      }
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      const batchSize = 10;
      for (let i = 1; i <= pdf.numPages; i += batchSize) {
        if (onProgress) {
          onProgress(`Extracting PDF pages ${i} to ${Math.min(i + batchSize - 1, pdf.numPages)} of ${pdf.numPages}...`);
        }
        const pagePromises = [];
        for (let j = 0; j < batchSize && (i + j) <= pdf.numPages; j++) {
          pagePromises.push(
            pdf.getPage(i + j).then(async (page) => {
              const content = await page.getTextContent();
              return content.items.map((item: any) => item.str).join(' ');
            })
          );
        }
        const pagesText = await Promise.all(pagePromises);
        text += pagesText.join('\n') + '\n';
      }
      return text;
    };

    try {
      return await extractPdf();
    } catch (error) {
      console.error("Primary PDF extraction failed, trying fallback worker...", error);
      return await extractPdf(`https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`);
    }
  }

  throw new Error(`Unsupported file type: ${extension}`);
}

export function splitIntoChapters(text: string): string[] {
  const maxChunkSize = 25000;
  const chapterRegex = /\n(?=(?:Chapter|Section|Part)\s+[0-9IVX]+)/gi;
  const originalSplits = text.split(chapterRegex).filter(s => s.trim().length > 100);
  
  let parts = originalSplits.length > 1 ? originalSplits : text.split(/\n\s*\n/);
  
  // If double newlines didn't yield enough parts, try single newlines
  if (parts.length < 5 && originalSplits.length <= 1) {
    parts = text.split('\n');
  }

  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const part of parts) {
    if (part.length > maxChunkSize) {
      // If a single part is massive, push current chunk and hard-slice the massive part
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      for (let i = 0; i < part.length; i += maxChunkSize) {
        chunks.push(part.slice(i, i + maxChunkSize));
      }
    } else if (currentChunk.length + part.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = part;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + part;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  // Absolute fallback just in case
  if (chunks.length === 0) {
    for (let i = 0; i < text.length; i += maxChunkSize) {
      chunks.push(text.slice(i, i + maxChunkSize));
    }
  }
  
  return chunks;
}

export async function processDocument(
  file: File, 
  options: PreprocessOptions, 
  onProgress: (msg: string) => void,
  callbacks?: {
    onDiscovered?: (chapters: Chapter[]) => void;
    onChapterDone?: (index: number, title: string, summary: string) => void;
  }
): Promise<Chapter[]> {
  onProgress('Extracting text...');
  const rawText = await extractTextFromFile(file, onProgress);
  
  onProgress('Preprocessing text...');
  const processedText = preprocessText(rawText, options);
  
  onProgress('Detecting hierarchy...');
  const chunks = splitIntoChapters(processedText);
  
  const allChapters: Chapter[] = [];
  let sortCounter = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const percent = Math.round((i / chunks.length) * 100);
    onProgress(`Extracting structure from chunk ${i + 1} of ${chunks.length}... (${percent}%)`);
    
    try {
      const hierarchy = await generateDocumentHierarchy(chunk, 3);
      
      if (hierarchy && typeof hierarchy === 'object') {
        const rootArr = hierarchy.parts || hierarchy.chapters || hierarchy.topics;
        if (hierarchy.parts && Array.isArray(hierarchy.parts)) {
          hierarchy.parts.forEach((part: any, pIdx: number) => {
             const partId = uuidv4();
             allChapters.push({
               id: partId,
               chapterNumber: pIdx + 1,
               title: part.title || `Part ${pIdx + 1}`,
               summary: part.summary || '',
               content: '',
               isGenerating: false,
               parentId: null,
               sortOrder: sortCounter++,
               type: 'part',
               children: []
             });
             
             if (part.chapters && Array.isArray(part.chapters)) {
               part.chapters.forEach((chap: any, cIdx: number) => {
                 const chapId = uuidv4();
                 allChapters.push({
                   id: chapId,
                   chapterNumber: cIdx + 1,
                   title: chap.title || `Chapter ${cIdx + 1}`,
                   summary: chap.summary || '',
                   content: '',
                   isGenerating: false,
                   parentId: partId,
                   sortOrder: sortCounter++,
                   type: 'chapter',
                   children: []
                 });
                 
                 if (chap.topics && Array.isArray(chap.topics)) {
                   chap.topics.forEach((topic: any, tIdx: number) => {
                     allChapters.push({
                       id: uuidv4(),
                       chapterNumber: tIdx + 1,
                       title: topic.title || `Topic ${tIdx + 1}`,
                       summary: topic.summary || '',
                       content: topic.content || chunk,
                       isGenerating: false,
                       parentId: chapId,
                       sortOrder: sortCounter++,
                       type: 'topic',
                       children: []
                     });
                   });
                 }
               });
             }
          });
        } else if (hierarchy.chapters && Array.isArray(hierarchy.chapters)) {
           hierarchy.chapters.forEach((chap: any, cIdx: number) => {
             const chapId = uuidv4();
             allChapters.push({
               id: chapId,
               chapterNumber: cIdx + 1,
               title: chap.title || `Chapter ${cIdx + 1}`,
               summary: chap.summary || '',
               content: '',
               isGenerating: false,
               parentId: null,
               sortOrder: sortCounter++,
               type: 'chapter',
               children: []
             });
             if (chap.topics && Array.isArray(chap.topics)) {
               chap.topics.forEach((topic: any, tIdx: number) => {
                 allChapters.push({
                   id: uuidv4(),
                   chapterNumber: tIdx + 1,
                   title: topic.title || `Topic ${tIdx + 1}`,
                   summary: topic.summary || '',
                   content: topic.content || chunk,
                   isGenerating: false,
                   parentId: chapId,
                   sortOrder: sortCounter++,
                   type: 'topic',
                   children: []
                 });
               });
             }
           });
        } else {
             const chapId = uuidv4();
             allChapters.push({
               id: chapId,
               chapterNumber: i + 1,
               title: `Section ${i + 1}`,
               summary: '',
               content: chunk,
               isGenerating: false,
               parentId: null,
               sortOrder: sortCounter++,
               type: 'topic',
               children: []
             });
        }
      } else {
             throw new Error("Invalid format");
      }
    } catch (err) {
      console.error("AI hierarchy fail:", err);
      allChapters.push({
         id: uuidv4(),
         chapterNumber: i + 1,
         title: `Section ${i + 1}`,
         summary: 'Failed to process structure',
         content: chunk,
         isGenerating: false,
         parentId: null,
         sortOrder: sortCounter++,
         type: 'topic',
         children: []
      });
    }
  }

  const chapterMap = new Map();
  const roots: Chapter[] = [];
  allChapters.forEach(ch => {
    chapterMap.set(ch.id, { ...ch, children: [] });
  });

  Array.from(chapterMap.values()).forEach(ch => {
    if (ch.parentId && chapterMap.has(ch.parentId)) {
      chapterMap.get(ch.parentId).children!.push(ch);
    } else {
      roots.push(ch);
    }
  });

  if (callbacks?.onDiscovered) {
    callbacks.onDiscovered(roots);
  }
  
  onProgress('Finalizing document...');
  return roots;
}
