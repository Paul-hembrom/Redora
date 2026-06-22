import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import mammoth from 'mammoth';
import ePub from 'epubjs';
import { PreprocessOptions, Chapter } from '../types';
import { v4 as uuidv4 } from 'uuid';
import {
  generateBatchChapterMetadata,
  extractTextFromImage,
  ApiRateLimitError,
  generateDocumentHierarchy,
  generateOutline,
  generateChapterMetadata,
  generateMinimalSummary,
} from './gemini';

// ---------------------------------------------------------------------------
// PDF.js worker setup
// ---------------------------------------------------------------------------
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in',
  'into', 'is', 'it', 'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the',
  'their', 'then', 'there', 'these', 'they', 'this', 'to', 'was', 'will', 'with',
]);

/** Maximum characters per chunk sent to the AI hierarchy API. */
const MAX_CHUNK_SIZE = 30_000;

/** Maximum concurrent AI hierarchy API calls at any time. */
const MAX_CONCURRENCY = 8;

/** Maximum number of retry attempts for rate-limited API calls. */
const MAX_RETRIES = 4;

/** Base delay (ms) for exponential backoff on rate-limit errors. */
const BACKOFF_BASE_MS = 5_000;

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Concurrency limiter
// ---------------------------------------------------------------------------
function createConcurrencyLimit(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  function next() {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const run = queue.shift()!;
    run();
  }

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}

// ---------------------------------------------------------------------------
// Retry wrapper with exponential backoff for ApiRateLimitError
// ---------------------------------------------------------------------------
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = MAX_RETRIES,
  baseDelayMs = BACKOFF_BASE_MS,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err instanceof ApiRateLimitError;
      if (!isRateLimit || attempt === maxRetries) throw err;

      const delay =
        (err as ApiRateLimitError).retryAfterMs ??
        baseDelayMs * Math.pow(2, attempt);
      console.warn(
        `[documentProcessor] Rate limit hit — retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('withRetry: unreachable');
}

// ---------------------------------------------------------------------------
// File text extraction (unchanged – your existing robust version)
// ---------------------------------------------------------------------------
export async function extractTextFromFile(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'txt') {
    const buf = await file.arrayBuffer();
    return new TextDecoder().decode(buf);
  }

  if (extension === 'epub') {
    if (onProgress) onProgress('Parsing EPUB…');
    const buf = await file.arrayBuffer();
    const book = ePub(buf);
    await book.ready;

    let text = '';
    const spineItems: any[] = (book.spine as any).spineItems ?? [];

    for (let i = 0; i < spineItems.length; i++) {
      if (onProgress) {
        onProgress(`Extracting EPUB chapter ${i + 1} of ${spineItems.length}…`);
      }
      const item = spineItems[i];
      const doc = await book.load(item.href);
      if (doc && (doc as any).body) {
        text += (doc as any).body.textContent + '\n\n';
      }
    }
    return text;
  }

  if (extension === 'docx') {
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return result.value;
  }

  if (['jpg', 'jpeg', 'png', 'webp'].includes(extension ?? '')) {
    if (onProgress) onProgress('Extracting text from image using AI…');
    const buf = await file.arrayBuffer();
    const base64Data = btoa(
      new Uint8Array(buf).reduce((data, byte) => data + String.fromCharCode(byte), ''),
    );
    const mimeType = file.type || `image/${extension === 'jpg' ? 'jpeg' : extension}`;
    return extractTextFromImage(base64Data, mimeType);
  }

  if (extension === 'pdf') {
    const extractPdf = async (): Promise<string> => {
      const fileUrl = URL.createObjectURL(file);
      let pdf: pdfjsLib.PDFDocumentProxy;
      try {
        pdf = await pdfjsLib.getDocument(fileUrl).promise;
      } finally {
        URL.revokeObjectURL(fileUrl);
      }

      const pageTexts: string[] = new Array(pdf.numPages);
      const batchSize = 10;

      for (let i = 1; i <= pdf.numPages; i += batchSize) {
        const end = Math.min(i + batchSize - 1, pdf.numPages);
        if (onProgress) {
          onProgress(`Extracting PDF pages ${i}–${end} of ${pdf.numPages}…`);
        }

        const batchPromises: Promise<void>[] = [];
        for (let j = i; j <= end; j++) {
          const pageIndex = j - 1;
          batchPromises.push(
            pdf.getPage(j).then(async page => {
              const content = await page.getTextContent();
              pageTexts[pageIndex] = content.items
                .map((item: any) => item.str)
                .join(' ');
              page.cleanup();
            }),
          );
        }
        await Promise.all(batchPromises);
      }

      return pageTexts.join('\n');
    };

    const extractPdfOcr = async (): Promise<string> => {
      const fileUrl = URL.createObjectURL(file);
      let pdf: pdfjsLib.PDFDocumentProxy;
      try {
        pdf = await pdfjsLib.getDocument(fileUrl).promise;
      } finally {
        URL.revokeObjectURL(fileUrl);
      }

      const pageTexts: string[] = new Array(pdf.numPages);
      const batchSize = 10;

      for (let i = 1; i <= pdf.numPages; i += batchSize) {
        const end = Math.min(i + batchSize - 1, pdf.numPages);
        if (onProgress) {
          onProgress(`OCR Fallback: Extracting PDF pages ${i}–${end} of ${pdf.numPages} using AI…`);
        }

        const batchPromises: Promise<void>[] = [];
        for (let j = i; j <= end; j++) {
          const pageIndex = j - 1;
          batchPromises.push(
            pdf.getPage(j).then(async page => {
              const viewport = page.getViewport({ scale: 1.5 });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              if (context) {
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport, canvas: canvas }).promise;
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                const base64Data = dataUrl.split(',')[1];
                
                pageTexts[pageIndex] = await extractTextFromImage(base64Data, 'image/jpeg');
              } else {
                pageTexts[pageIndex] = '';
              }
              page.cleanup();
            })
          );
        }
        await Promise.all(batchPromises);
      }

      return pageTexts.join('\n');
    };

    try {
      let text = await extractPdf();
      if (text.trim().length < 100) {
         if (onProgress) onProgress('PDF contains no text, attempting OCR fallback...');
         text = await extractPdfOcr();
      }
      return text;
    } catch (error) {
      console.error('[documentProcessor] Primary PDF extraction failed:', error);
      throw new Error('PDF viewer could not be initialised. Please refresh or try a different file.');
    }
  }

  throw new Error(`Unsupported file type: ${extension}`);
}

// ---------------------------------------------------------------------------
// Chapter / chunk splitting (old AI‑ready chunks, kept for fallback)
// ---------------------------------------------------------------------------
export function splitIntoChapters(text: string): string[] {
  let dynamicChunkSize = Math.max(8_000, Math.min(30_000, Math.ceil(text.length / MAX_CONCURRENCY)));
  if (text.length > 500_000) {
     dynamicChunkSize = Math.min(60_000, Math.ceil(text.length / (MAX_CONCURRENCY * 2)));
  }

  const chapterRegex = /\n(?=(?:Chapter|Section|Part)\s+[0-9IVX]+)/gi;
  const originalSplits = text.split(chapterRegex).filter(s => s.trim().length > 100);

  let parts = originalSplits.length > 1 ? originalSplits : text.split(/\n\s*\n/);

  if (parts.length < 5 && originalSplits.length <= 1) {
    parts = text.split('\n');
  }

  const chunks: string[] = [];
  let currentChunk = '';

  for (const part of parts) {
    if (part.length > dynamicChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      for (let i = 0; i < part.length; i += dynamicChunkSize) {
        chunks.push(part.slice(i, i + dynamicChunkSize));
      }
    } else if (
      currentChunk.length + part.length > dynamicChunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk);
      currentChunk = part;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + part;
    }
  }

  if (currentChunk) chunks.push(currentChunk);

  if (chunks.length === 0) {
    for (let i = 0; i < text.length; i += dynamicChunkSize) {
      chunks.push(text.slice(i, i + dynamicChunkSize));
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Preprocessing filters for textbooks
// ---------------------------------------------------------------------------
export function stripFrontMatter(text: string): string {
  // Remove the leading filename and "Download PDF" if it appears at the very start
  const startsWithPdfNoise = /^[\s\n]*[^\n]*?(?:computer class|class)\s*\d+\.pdf[\s\n]*Download PDF/i.test(text);
  if (startsWithPdfNoise) {
    const dropIndex = text.indexOf('Download PDF') + 'Download PDF'.length;
    const nextNewline = text.indexOf('\n', dropIndex);
    return nextNewline > -1 ? text.slice(nextNewline + 1).trim() : text.slice(dropIndex).trim();
  }

  // Existing check for publisher info
  const checkArea = text.slice(0, 1000);
  if (/(?:publisher|author|edition|isbn|copyright|all rights reserved)/i.test(checkArea)) {
    const dropIndex = 500;
    const nextNewline = text.indexOf('\n', dropIndex);
    return nextNewline > -1 ? text.slice(nextNewline + 1).trim() : text.slice(dropIndex).trim();
  }
  return text;
}

export function stripRepeatingHeaders(text: string): string {
  const lines = text.split('\n');
  const lineCounts = new Map<string, number>();
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.length < 100) {
      lineCounts.set(trimmed, (lineCounts.get(trimmed) || 0) + 1);
    }
  }
  
  const repeatingLines = new Set<string>();
  for (const [line, count] of lineCounts.entries()) {
    if (count > 3) {
      repeatingLines.add(line);
    }
  }
  
  return lines.filter(line => {
    const trimmed = line.trim();
    if (repeatingLines.has(trimmed)) return false;
    if (/download pdf/i.test(trimmed)) return false;
    if (/← previous/i.test(trimmed)) return false;
    if (/next: →/i.test(trimmed)) return false;
    // Catch navigation links perfectly
    if (/previous:/i.test(trimmed)) return false;
    if (/next:/i.test(trimmed)) return false;
    if (/download pdf\s*\d*/i.test(trimmed)) return false; // "Download PDF 1", etc.
    if (/^[A-Z\s\-0-9]+\s+\d{1,3}$/i.test(trimmed) && trimmed.length > 5 && trimmed.length < 50) return false;
    return true;
  }).join('\n');
}

// ---------------------------------------------------------------------------
// Hybrid chapter detection (regex‑based, used as final fallback)
// ---------------------------------------------------------------------------
export function splitIntoChaptersEnhanced(text: string, titleOffset = 0, sortCounterStart = 0): Chapter[] {
  const allChapters: Chapter[] = [];
  let sortCounter = sortCounterStart;

  const chapterRegex = /(?=\n\s*(?:(?:Unit|Chapter|Section|Part)\s+[0-9IVX]+(?:\s*[:\-]?\s*[^\n]{0,100})?|\d+\.\s+[A-Z]|\(Page\s*\d+\)))/gi;
  
  const evalText = text.startsWith('\n') ? text : '\n' + text;
  let originalSplits = evalText.split(chapterRegex).filter(s => s.trim().length > 50);

  if (originalSplits.length <= 1) {
    originalSplits = [text];
  }

  let chapterIndex = titleOffset + 1;

  for (const part of originalSplits) {
    let titleStr = `Section ${chapterIndex}`;
    let contentToProcess = part.trim();
    const firstLineMatch = contentToProcess.match(/^(?:(?:Unit|Chapter|Section|Part)\s+[0-9IVX]+(?:[:\-]?\s*[^\n]+)?|\d+\.\s+[^\n]+|\(Page\s*\d+\)[^\n]*)/i);
    if (firstLineMatch) {
      titleStr = firstLineMatch[0].trim();
      if (contentToProcess.startsWith(titleStr)) {
        contentToProcess = contentToProcess.substring(titleStr.length).trim();
      }
    } else {
      const firstLine = contentToProcess.split('\n')[0].trim();
      if (firstLine && firstLine.length < 80) {
        titleStr = firstLine;
        contentToProcess = contentToProcess.substring(firstLine.length).trim();
      } else if (originalSplits.length === 1) {
        titleStr = `Section ${chapterIndex}`;
      }
    }

    const chapterId = uuidv4();
    
    const subtopicRegex = /(?=\n\s*(?:\d+\.\d+(?:\.\d+)*|(?:[a-z]\.|[ivx]+\.)\s+[A-Z]|\*\*[^\n]+\*\*|[^\n]+:\n\s*(?:[-*•]|\d+\.)))/gi;
    const subSplits = contentToProcess.split(subtopicRegex).filter(s => s.trim().length > 20);

    if (subSplits.length > 1) {
      const preamble = subSplits[0].trim();
      
      allChapters.push({
        id: chapterId,
        chapterNumber: chapterIndex,
        title: titleStr,
        summary: '',
        content: preamble,
        isGenerating: false,
        parentId: null,
        sortOrder: sortCounter++,
        type: 'chapter',
        children: []
      });

      for (let i = 1; i < subSplits.length; i++) {
        const sub = subSplits[i].trim();
        let subTitle = `Topic ${chapterIndex}.${i}`;
        const subFirstLineMatch = sub.match(/^(?:\d+\.\d+(?:\.\d+)*|(?:[a-z]\.|[ivx]+\.)\s+[^\n]+|\*\*[^\n]+\*\*|[^\n]+:)/i);
        
        let subContent = sub;
        if (subFirstLineMatch) {
          subTitle = subFirstLineMatch[0].replace(/\*\*/g, '').trim();
          subContent = sub.substring(subFirstLineMatch[0].length).trim();
        } else {
          const firstLine = sub.split('\n')[0].trim();
          if (firstLine && firstLine.length < 80) {
            subTitle = firstLine.replace(/\*\*/g, '');
            subContent = sub.substring(firstLine.length).trim();
          }
        }

        allChapters.push({
          id: uuidv4(),
          chapterNumber: i,
          title: subTitle,
          summary: '',
          content: subContent,
          isGenerating: false,
          parentId: chapterId,
          sortOrder: sortCounter++,
          type: 'topic',
          children: []
        });
      }
    } else {
      allChapters.push({
        id: chapterId,
        chapterNumber: chapterIndex,
        title: titleStr,
        summary: '',
        content: contentToProcess,
        isGenerating: false,
        parentId: null,
        sortOrder: sortCounter++,
        type: 'chapter',
        children: []
      });
    }

    chapterIndex++;
  }

  return allChapters;
}

// ---------------------------------------------------------------------------
// Hierarchy parsing helpers
// ---------------------------------------------------------------------------
function parseHierarchyIntoChapters(
  hierarchy: any,
  chunk: string,
  allChapters: Chapter[],
  sortCounter: { value: number },
): void {
  if (!hierarchy || typeof hierarchy !== 'object') {
    throw new Error('Invalid hierarchy format');
  }

  if (hierarchy.parts && Array.isArray(hierarchy.parts)) {
    hierarchy.parts.forEach((part: any, pIdx: number) => {
      const partId = uuidv4();
      allChapters.push({
        id: partId,
        chapterNumber: pIdx + 1,
        title: part.title || `Part ${pIdx + 1}`,
        summary: '',                         
        content: part.content || '',
        isGenerating: false,
        parentId: null,
        sortOrder: sortCounter.value++,
        type: 'part',
        children: [],
      });

      if (part.chapters && Array.isArray(part.chapters)) {
        part.chapters.forEach((chap: any, cIdx: number) => {
          const chapId = uuidv4();
          allChapters.push({
            id: chapId,
            chapterNumber: cIdx + 1,
            title: chap.title || `Chapter ${cIdx + 1}`,
            summary: '',                     
            content: chap.content || '',
            isGenerating: false,
            parentId: partId,
            sortOrder: sortCounter.value++,
            type: 'chapter',
            children: [],
          });

          if (chap.topics && Array.isArray(chap.topics)) {
            chap.topics.forEach((topic: any, tIdx: number) => {
              allChapters.push({
                id: uuidv4(),
                chapterNumber: tIdx + 1,
                title: topic.title || `Topic ${tIdx + 1}`,
                summary: '',                 
                content: topic.content || '',   
                isGenerating: false,
                parentId: chapId,
                sortOrder: sortCounter.value++,
                type: 'topic',
                children: [],
              });
            });
          }
        });
      }
    });
    return;
  }

  if (hierarchy.chapters && Array.isArray(hierarchy.chapters)) {
    hierarchy.chapters.forEach((chap: any, cIdx: number) => {
      const chapId = uuidv4();
      allChapters.push({
        id: chapId,
        chapterNumber: cIdx + 1,
        title: chap.title || `Chapter ${cIdx + 1}`,
        summary: '',
        content: chap.content || '',
        isGenerating: false,
        parentId: null,
        sortOrder: sortCounter.value++,
        type: 'chapter',
        children: [],
      });

      if (chap.topics && Array.isArray(chap.topics)) {
        chap.topics.forEach((topic: any, tIdx: number) => {
          allChapters.push({
            id: uuidv4(),
            chapterNumber: tIdx + 1,
            title: topic.title || `Topic ${tIdx + 1}`,
            summary: '',
            content: topic.content || '',
            isGenerating: false,
            parentId: chapId,
            sortOrder: sortCounter.value++,
            type: 'topic',
            children: [],
          });
        });
      }
    });
    return;
  }

  if (hierarchy.topics && Array.isArray(hierarchy.topics)) {
    hierarchy.topics.forEach((topic: any, tIdx: number) => {
      allChapters.push({
        id: uuidv4(),
        chapterNumber: tIdx + 1,
        title: topic.title || `Topic ${tIdx + 1}`,
        summary: '',
        content: topic.content || '',
        isGenerating: false,
        parentId: null,
        sortOrder: sortCounter.value++,
        type: 'topic',
        children: [],
      });
    });
    return;
  }

  throw new Error('Hierarchy contained no parts, chapters, or topics');
}

// ---------------------------------------------------------------------------
// Clean academic paper hierarchy
// ---------------------------------------------------------------------------
function cleanAcademicPaperHierarchy(nodes: Chapter[]): Chapter[] {
  let cleaned = [...nodes];

  cleaned.forEach(node => {
    if (node.children && node.children.length > 0) {
      node.children = cleanAcademicPaperHierarchy(node.children);
    }
  });

  const sanitizeTitle = (t: string) => (t || '').toLowerCase().replace(/^(part|chapter)\s*\d*[:\-]?\s*/i, '').trim();

  cleaned = cleaned.filter(ch => {
    const titleLower = (ch.title || '').toLowerCase();
    if (titleLower.includes('main text') && (!ch.children || ch.children.length === 0)) {
      return false;
    }
    return true;
  });

  let i = 0;
  while (i < cleaned.length - 1) {
    const a = cleaned[i];
    const b = cleaned[i + 1];
    const aClean = sanitizeTitle(a.title);
    const bClean = sanitizeTitle(b.title);
    
    if (aClean === bClean && aClean.length > 0) {
      a.summary = (a.summary || '').length > (b.summary || '').length ? a.summary : (b.summary || '');
      a.content = [a.content, b.content].filter(x => x && x.trim().length > 0).join('\n\n');
      if (a.children || b.children) {
        a.children = [...(a.children || []), ...(b.children || [])];
      }
      cleaned.splice(i + 1, 1);
    } else {
      i++;
    }
  }

  let finalNodes: Chapter[] = [];
  for (const node of cleaned) {
    if ((node.type === 'part' || node.type === 'chapter') && node.children?.length === 1) {
      const singleChild = node.children[0];
      if (singleChild.type === 'topic' && /references?/i.test(singleChild.title || '')) {
         finalNodes.push(singleChild);
         continue;
      }
    }

    if (node.type === 'part' && node.children?.length === 1) {
      const singleChapter = node.children[0];
      if (singleChapter.type === 'chapter' && singleChapter.children && singleChapter.children.every(c => c.type === 'topic')) {
        const partClean = sanitizeTitle(node.title);
        const chClean = sanitizeTitle(singleChapter.title);
        
        if (partClean === chClean || partClean === '') {
          if (chClean === '' && singleChapter.children.length > 0) {
             finalNodes.push(...singleChapter.children);
          } else {
             finalNodes.push(singleChapter);
          }
          continue;
        }
      }
    }

    finalNodes.push(node);
  }

  return finalNodes;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractByOutline(text: string, outline: {title: string, subtopics: string[]}[]): Chapter[] {
  const chapters: Chapter[] = [];
  let sortCounter = 0;
  
  // --- Skip the Table of Contents ---
  let contentStartIndex = 0;
  const tocRegex = /(?:Table\s+of\s+Contents|CONTENTS|TABLE\s+OF\s+CONTENTS)/i;
  const tocMatch = text.match(tocRegex);
  if (tocMatch && tocMatch.index !== undefined) {
    // Start searching 2000 chars after the TOC, to be safe
    contentStartIndex = tocMatch.index + 2000; 
  }

  // --- Filter out backmatter ---
  const BACKMATTER_TITLES = ['abbreviations', 'bibliography', 'model questions', 'index', 'references'];
  const cleanOutline = outline
    .map(c => ({
      title: c.title.trim(),
      subtopics: (c.subtopics || []).map(t => t.trim()).filter(Boolean)
    }))
    .filter(c => c.title && !BACKMATTER_TITLES.some(bt => c.title.toLowerCase().includes(bt)));

  // --- Harden title searching to skip navigation lines ---
  const findChapterIndex = (text: string, title: string, startSearch: number): number => {
    let pos = text.indexOf(title, startSearch);
    while (pos !== -1) {
      const lineStart = text.lastIndexOf('\n', pos);
      const lineEnd = text.indexOf('\n', pos + title.length);
      const line = text.substring(lineStart + 1, lineEnd === -1 ? undefined : lineEnd).trim();

      // Skip matching lines if they contain any of this junk
      if (/^(?:next|previous)\s*[:\-]?\s*/i.test(line) ||
          /download\s*pdf/i.test(line) ||
          /← previous/i.test(line) ||
          /next: →/i.test(line)) {
        pos = text.indexOf(title, pos + title.length);
        continue;
      }
      return pos;
    }
    return -1;
  };

  const chapterMatchs = cleanOutline.map(c => {
    let idx = findChapterIndex(text, c.title, contentStartIndex);
    if (idx === -1) {
      // Fallback to fuzzy regex if plain text match fails
      const regexStr = c.title.split(/\s+/).map(escapeRegExp).join('\\s+');
      const regex = new RegExp(regexStr, 'i');
      const match = text.substring(contentStartIndex).match(regex);
      if (match && match.index !== undefined) idx = contentStartIndex + match.index;
    }
    return { outline: c, idx };
  }).filter(m => m.idx !== -1).sort((a, b) => a.idx - b.idx);
  
  // Process each chapter (existing for-loop with Exercise extraction and subtopic logic)
  for (let i = 0; i < chapterMatchs.length; i++) {
    const match = chapterMatchs[i];
    const nextMatch = i + 1 < chapterMatchs.length ? chapterMatchs[i+1] : null;
    
    let chapterEnd = nextMatch ? nextMatch.idx : text.length;
    let chapterContent = text.substring(match.idx, chapterEnd).trim();
    
    // Remove leading navigation junk again just in case
    chapterContent = chapterContent.replace(/^(?:[\s\n]*download\s*pdf[\s\n\d]*|[\s\n]*←\s*previous:.*|[\s\n]*next:\s*→?.*?[\n\r]+)/i, '').trim();

    let chapterRegex = new RegExp(`^${match.outline.title.split(/\s+/).map(escapeRegExp).join('\\s+')}`, 'i');
    chapterContent = chapterContent.replace(chapterRegex, '').trim();
    
    const chapId = uuidv4();
    const subtopics: Chapter[] = [];
    
    // Split content to get "Exercise" section
    let mainContent = chapterContent;
    let exerciseContent = '';
    const exerciseRegex = /\n\s*(?:Exercise|Exercises|Practice)\b/i; 
    const exerciseMatch = chapterContent.match(exerciseRegex);
    if (exerciseMatch && exerciseMatch.index !== undefined) {
      mainContent = chapterContent.substring(0, exerciseMatch.index).trim();
      exerciseContent = chapterContent.substring(exerciseMatch.index).trim();
    }

    // Process subtopics (keeping existing logic)
    if (match.outline.subtopics && match.outline.subtopics.length > 0) {
      const topicMatchs = match.outline.subtopics.map(t => {
        let idx = mainContent.indexOf(t);
        if (idx === -1) {
          const regexStr = t.split(/\s+/).map(escapeRegExp).join('\\s+');
          const regex = new RegExp(regexStr, 'i');
          const m = mainContent.match(regex);
          if (m && m.index !== undefined) idx = m.index;
        }
        return { title: t, idx };
      }).filter(m => m.idx !== -1).sort((a, b) => a.idx - b.idx);
      
      if (topicMatchs.length > 0) {
        const preambleContent = mainContent.substring(0, topicMatchs[0].idx).trim();
        if (preambleContent.length > 20) {
          subtopics.push({
            id: uuidv4(), chapterNumber: 0,
            title: `${match.outline.title} - Introduction`,
            summary: '', content: preambleContent,
            isGenerating: false, parentId: chapId,
            sortOrder: sortCounter++, type: 'topic', children: []
          });
        }
        
        for (let j = 0; j < topicMatchs.length; j++) {
          const tMatch = topicMatchs[j];
          const nextTMatch = j + 1 < topicMatchs.length ? topicMatchs[j+1] : null;
          const endIdx = nextTMatch ? nextTMatch.idx : mainContent.length;
          
          let topicContent = mainContent.substring(tMatch.idx, endIdx).trim();
          let topicRegex = new RegExp(`^${tMatch.title.split(/\s+/).map(escapeRegExp).join('\\s+')}`, 'i');
          topicContent = topicContent.replace(topicRegex, '').trim();
          
          subtopics.push({
            id: uuidv4(), chapterNumber: j + 1,
            title: tMatch.title, summary: '',
            content: topicContent, isGenerating: false,
            parentId: chapId, sortOrder: sortCounter++,
            type: 'topic', children: []
          });
        }
        mainContent = ''; 
      }
    }

    // Add Exercise Chat node
    if (exerciseContent) {
      subtopics.push({
        id: uuidv4(),
        chapterNumber: match.outline.subtopics ? match.outline.subtopics.length + 1 : 1,
        title: 'Chapter Exercises',
        summary: '',
        content: exerciseContent,
        isGenerating: false,
        parentId: chapId,
        sortOrder: sortCounter++,
        type: 'exercise',
        children: []
      });
    }

    chapters.push({
      id: chapId, chapterNumber: i + 1,
      title: match.outline.title, summary: '',
      content: mainContent, isGenerating: false,
      parentId: null, sortOrder: sortCounter++,
      type: 'chapter', children: subtopics
    });
  }
  
  return chapters;
}

// ---------------------------------------------------------------------------
// Main document processing pipeline (Refactored to strict Step A-E)
// ---------------------------------------------------------------------------

/**
 * Full pipeline: extract → preprocess → AI Outline → Content Split → (Optional) Deep AI summaries
 */
export async function processDocument(
  file: File,
  options: PreprocessOptions,
  onProgress: (msg: string) => void,
  callbacks?: {
    onDiscovered?: (chapters: Chapter[]) => void;
    onChapterDone?: (id: string, title: string, summary: string) => void;
  },
): Promise<Chapter[]> {
  // --------------------------------------------------------------------------
  // Step A: Extract & Sanitize
  // --------------------------------------------------------------------------
  onProgress('Extracting text…');
  const rawText = await extractTextFromFile(file, onProgress);
  
  let sanitizedText = rawText.replace(/\x00/g, '');

  if (sanitizedText.trim().length === 0) {
    throw new Error('No readable text found in this document. Try a different file or a clearer scan.');
  }

  onProgress('Preprocessing text…');
  sanitizedText = stripFrontMatter(sanitizedText);
  sanitizedText = stripRepeatingHeaders(sanitizedText);
  const processedText = preprocessText(sanitizedText, options);

  let finalChapters: Chapter[] = [];

  // --------------------------------------------------------------------------
  // Step B: Call AI for Outline (Lightweight)
  // --------------------------------------------------------------------------
  onProgress('Analyzing document structure with AI…');
  let outline = await generateOutline(processedText);

  // --------------------------------------------------------------------------
  // Step C: If Outline is found, use exact position matching
  // --------------------------------------------------------------------------
  if (outline && outline.length > 0) {
    onProgress(`Detected ${outline.length} chapters. Extracting content via precise position mapping…`);
    finalChapters = extractByOutline(processedText, outline);
    
    // If extraction returned nothing despite valid outline, fallback to regex
    if (finalChapters.length === 0) {
      onProgress('Outline extraction failed to match text, falling back to regex…');
      finalChapters = splitIntoChaptersEnhanced(processedText);
    }
  } 
  // --------------------------------------------------------------------------
  // Step D: If Outline is empty, fallback to Regex Splitting
  // --------------------------------------------------------------------------
  else {
    onProgress('No clear outline found by AI, falling back to regex pattern matching…');
    finalChapters = splitIntoChaptersEnhanced(processedText);
  }

  // --------------------------------------------------------------------------
  // Post‑processing: Clean duplicates/flatten hierarchy
  // --------------------------------------------------------------------------
  onProgress(`Processing ${finalChapters.length} sections into hierarchy…`);
  finalChapters = cleanAcademicPaperHierarchy(finalChapters);
  finalChapters.forEach(ch => { ch.isGenerating = false; });

  // Call `onDiscovered` immediately so UI can render the tree
  callbacks?.onDiscovered?.(finalChapters);

  // --------------------------------------------------------------------------
  // Step E: If `options.deepProcess` is true, run Batch AI Metadata
  // --------------------------------------------------------------------------
  if (options.deepProcess) {
    onProgress('Generating detailed summaries (Deep Process)…');

    const BATCH_SIZE = 5;
    const batches: Chapter[][] = [];
    for (let i = 0; i < finalChapters.length; i += BATCH_SIZE) {
      batches.push(finalChapters.slice(i, i + BATCH_SIZE));
    }

    const deepLimit = createConcurrencyLimit(MAX_CONCURRENCY);
    const deepJobs = batches.map((batch, batchIdx) =>
      deepLimit(async () => {
        try {
          const batchData = batch.map(ch => ({
            content: ch.content,
            chapterNumber: ch.chapterNumber
          }));

          const percent = Math.round(((batchIdx + 1) / batches.length) * 100);
          onProgress(`Deep processing: batch ${batchIdx + 1} of ${batches.length} (${percent}%)…`);

          const metadataMap = await withRetry(() =>
            generateBatchChapterMetadata(batchData, 3, options.summaryDetail || 'detailed')
          );

          for (const ch of batch) {
            const meta = metadataMap[ch.chapterNumber];
            if (meta) {
              ch.title = meta.title;
              ch.summary = meta.summary;
            } else {
              ch.summary = 'Summary temporarily unavailable.';
            }
            callbacks?.onChapterDone?.(ch.id, ch.title, ch.summary);
          }
        } catch (err) {
          for (const ch of batch) {
            if (!ch.summary) ch.summary = 'Summary temporarily unavailable.';
            callbacks?.onChapterDone?.(ch.id, ch.title, ch.summary);
          }
        }
      })
    );

    await Promise.all(deepJobs);
  }

  // Re‑assign sort order to top‑level items
  let sortOrderCounter = 0;
  for (const root of finalChapters) {
    root.sortOrder = sortOrderCounter++;
  }

  onProgress('Done.');
  return finalChapters;
}