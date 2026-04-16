import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import mammoth from 'mammoth';
import ePub from 'epubjs';
import { PreprocessOptions, Chapter } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { generateChapterMetadata, extractTextFromImage } from './gemini';

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
  const chapterRegex = /\n(?=(?:Chapter|Section|Part)\s+[0-9IVX]+)/gi;
  const splits = text.split(chapterRegex).filter(s => s.trim().length > 100);
  
  if (splits.length > 1) {
    return splits;
  }
  
  // Fallback: Split by paragraphs, accumulating up to a max chunk size
  const maxChunkSize = 15000;
  let parts = text.split(/\n\s*\n/);
  
  // If double newlines didn't yield enough parts, try single newlines
  if (parts.length < 5) {
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
  
  onProgress('Detecting chapters...');
  const chunks = splitIntoChapters(processedText);
  
  const chapters: Chapter[] = chunks.map((chunk, i) => ({
    id: uuidv4(),
    chapterNumber: i + 1,
    title: `Chapter ${i + 1}`,
    summary: '',
    content: chunk,
    isGenerating: true
  }));

  if (callbacks?.onDiscovered) {
    callbacks.onDiscovered(chapters);
  }
  
  for (let i = 0; i < chapters.length; i++) {
    const percent = Math.round(((i) / chapters.length) * 100);
    onProgress(`Analyzing Chapter ${i + 1} of ${chapters.length}... (${percent}%)`);
    try {
      const metadata = await generateChapterMetadata(chapters[i].content, i + 1);
      chapters[i].title = metadata.title;
      chapters[i].summary = metadata.summary;
      chapters[i].isGenerating = false;
      if (callbacks?.onChapterDone) callbacks.onChapterDone(i, metadata.title, metadata.summary);
      
      // Add a small delay to avoid hitting Gemini API rate limits (15 RPM for free tier)
      if (i < chapters.length - 1) {
        onProgress(`Waiting for rate limits before Chapter ${i + 2}...`);
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    } catch (err: any) {
      console.error(`Failed to generate metadata for chapter ${i + 1}`, err);
      chapters[i].summary = `*Summary generation failed: ${err.message || 'Unknown error. Please check your API key and rate limits.'}*`;
      chapters[i].isGenerating = false;
      if (callbacks?.onChapterDone) callbacks.onChapterDone(i, chapters[i].title, chapters[i].summary);
    }
  }
  
  onProgress('Finalizing document...');
  return chapters;
}
