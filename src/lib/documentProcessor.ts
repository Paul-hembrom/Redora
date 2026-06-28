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
  callLLM,
  extractViaAI,
  extractChapterViaAI
} from './gemini';

// ---------------------------------------------------------------------------
// PDF.js worker setup
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
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
    const extractPdf = async (): Promise<{ texts: string[], numPages: number }> => {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

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
              let pageText = '';
              let lastY: number | undefined;
              for (const item of content.items as any[]) {
                if (item.transform && item.transform.length >= 6) {
                  const y = item.transform[5];
                  if (lastY !== undefined && Math.abs(lastY - y) > 5) {
                    pageText += '\n';
                  } else if (lastY !== undefined) {
                    pageText += ' ';
                  }
                  pageText += item.str;
                  lastY = y;
                } else {
                  pageText += item.str + (item.hasEOL ? '\n' : ' ');
                }
              }
              pageTexts[pageIndex] = pageText;
              page.cleanup();
            }),
          );
        }
        await Promise.all(batchPromises);
      }

      return { texts: pageTexts, numPages: pdf.numPages };
    };

    const extractPdfOcrForPages = async (pageIndicesToOcr: number[]): Promise<string[]> => {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const pageTexts: string[] = new Array(pdf.numPages).fill('');
      const batchSize = 3;

      for (let i = 0; i < pageIndicesToOcr.length; i += batchSize) {
        const batchIndices = pageIndicesToOcr.slice(i, i + batchSize);
        if (onProgress) {
          onProgress(`OCR Fallback: Extracting PDF pages ${i + 1}–${Math.min(i + batchSize, pageIndicesToOcr.length)} of ${pageIndicesToOcr.length} empty pages using AI…`);
        }

        const batchPromises: Promise<void>[] = [];
        for (const pageIndex of batchIndices) {
          batchPromises.push(
            pdf.getPage(pageIndex + 1).then(async page => {
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
              }
              page.cleanup();
            })
          );
        }
        await Promise.all(batchPromises);
      }

      return pageTexts;
    };

    try {
      let { texts, numPages } = await extractPdf();
      
      const emptyPageIndices: number[] = [];
      for (let i = 0; i < texts.length; i++) {
        if (!texts[i] || texts[i].trim().length < 20) {
          emptyPageIndices.push(i);
        }
      }

      // If more than 85% of pages are empty, it's likely a scanned document.
      // Otherwise, we assume the empty pages are just images/figures and skip OCR for them.
      if (emptyPageIndices.length > 0 && (emptyPageIndices.length / Math.max(1, numPages)) > 0.85) {
         if (onProgress) onProgress(`Document appears to be scanned (${emptyPageIndices.length} empty pages). Attempting OCR fallback (max 30 pages to prevent timeout)...`);
         // Limit OCR to max 30 pages to prevent extreme timeouts on large scanned books
         const pagesToOcr = emptyPageIndices.slice(0, 30);
         const ocrTexts = await extractPdfOcrForPages(pagesToOcr);
         for (let i = 0; i < pagesToOcr.length; i++) {
           texts[pagesToOcr[i]] = ocrTexts[i];
         }
         if (emptyPageIndices.length > 30) {
            if (onProgress) onProgress(`Skipped OCR for ${emptyPageIndices.length - 30} pages to avoid timeouts.`);
         }
      }
      
      return texts.join('\n');
    } catch (error: any) {
      console.error('[documentProcessor] PDF extraction failed:', error);
      throw new Error(error?.message || 'Could not extract text from PDF. It may be protected or the OCR fallback failed.');
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
// PREPROCESSING FILTERS
// ---------------------------------------------------------------------------

/** 
 * Aggressively strips PDF noise, cover pages, and "Download PDF" 
 * to allow the extractor to start cleanly.
 */
export function stripFrontMatter(text: string): string {
  // Step 1: Find the exact start position of "Unit 1" or similar chapter headings
  const unit1Match = text.match(/(?:Unit|Chapter|Section|Part|Lesson|Module)(?:\s+[0-9IVX]+)?(?:\s*[:\-]?\s*[A-Z][a-zA-Z0-9\s]*\b)?\n/i);
  if (unit1Match && unit1Match.index !== undefined) {
    return text.slice(unit1Match.index).trim();
  }
  
  // Step 2: Fallback: try to find "1. Introduction" or "1 Introduction"
  const altMatch = text.match(/\n\s*1\.?\s*Introduction/i);
  if (altMatch && altMatch.index !== undefined) {
    return text.slice(altMatch.index).trim();
  }
  
  // Step 3: Ultimate fallback: keep the old cover-page stripping logic
  const checkArea = text.slice(0, 2000);
  if (/computer class/i.test(checkArea) || /download pdf/i.test(checkArea)) {
    const dropIndex = text.indexOf('Download PDF') + 'Download PDF'.length;
    const nextNewline = text.indexOf('\n', dropIndex);
    return nextNewline > -1 ? text.slice(nextNewline + 1).trim() : text.slice(dropIndex).trim();
  }
  return text;
}

/** 
 * Stricter regex to strip page numbers, repeated headers, and navigation links.
 */
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
    if (/previous:/i.test(trimmed)) return false;
    if (/next:/i.test(trimmed)) return false;
    // Strip isolated page numbers or repeated headers like "EUREKA LOGIC..."
    if (/^eureka\s+logic/i.test(trimmed)) return false;
    // This regex specifically catches lines like "- 7 16", "- 7 17" which are breaking the sub-topic detection
    if (/^[-]?\s*\d+\s+\d+$/i.test(trimmed)) return false;
    if (/^[A-Z\s\-0-9]+\s+\d{1,3}$/i.test(trimmed) && trimmed.length > 5 && trimmed.length < 80) return false;
    // New: Remove any line that starts with "Page Preview" or "Table of Contents"
    if (/^page\s+preview/i.test(trimmed)) return false;
    if (/^table\s+of\s+contents/i.test(trimmed)) return false;
    return true;
  }).join('\n');
}

// ---------------------------------------------------------------------------
// Hybrid chapter detection (regex‑based, used as final fallback)
// ---------------------------------------------------------------------------
export function splitIntoChaptersEnhanced(text: string, titleOffset = 0, sortCounterStart = 0): Chapter[] {
  const allChapters: Chapter[] = [];
  let sortCounter = sortCounterStart;

  let chapterRegex = /(?=\n\s*(?:Unit|CHAPTER|Chapter|Section|Part|Lesson|Module|Topic|PART|SECTION)(?:\s+[0-9IVX]+)?(?:\s*[:\-]?\s*[A-Z][a-zA-Z0-9\s]*\b)?\n?)/gi;
  
  const evalText = text.startsWith('\n') ? text : '\n' + text;
  let originalSplits = evalText.split(chapterRegex).filter(s => s.trim().length > 50);

  if (originalSplits.length <= 1) {
    chapterRegex = /(?=\n\s*\d+\.\s+[A-Z])/gi;
    originalSplits = evalText.split(chapterRegex).filter(s => s.trim().length > 50);
  }

  if (originalSplits.length <= 1) {
    originalSplits = [text];
  }

  let chapterIndex = titleOffset + 1;

  for (const part of originalSplits) {
    let titleStr = `Section ${chapterIndex}`;
    let contentToProcess = part.trim();
    // Allow matching e.g. "Unit INTRODUCTION" or "Chapter 1: Intro"
    const firstLineMatch = contentToProcess.match(/^(?:(?:Unit|Chapter|Section|Part|Lesson|Module)(?:\s+[0-9IVX]+)?(?:[:\-]?\s*[^\n]+)?|\d+\.\s+[^\n]+|\(Page\s*\d+\)[^\n]*)/i);
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

// ---------------------------------------------------------------------------
// EXTRACT BY OUTLINE (MANUAL SPLITTER + NAVIGATION STRIPPER)
// ---------------------------------------------------------------------------
export async function extractByOutline(text: string, outline: {title: string, subtopics: string[]}[]): Promise<Chapter[]> {
  const chapters: Chapter[] = [];
  let sortCounter = 0;

  // Skip past the Table of Contents
  let contentStartIndex = 0;
  const tocRegex = /(?:Table\s+of\s+Contents|CONTENTS|TABLE\s+OF\s+CONTENTS)/i;
  const tocMatch = text.match(tocRegex);
  if (tocMatch && tocMatch.index !== undefined) {
    const firstRealChapterMatch = text.substring(tocMatch.index).match(/\n\s*(?:Unit|Chapter|Section)\s+[0-9IVX]+\s+[A-Z][A-Za-z\s]+/i);
    if (firstRealChapterMatch && firstRealChapterMatch.index !== undefined) {
      contentStartIndex = tocMatch.index + firstRealChapterMatch.index;
    } else {
      contentStartIndex = tocMatch.index + 5000;
    }
  }

  const findChapterIndex = (text: string, title: string, startSearch: number): number => {
    let pos = text.indexOf(title, startSearch);
    while (pos !== -1) {
      const lineStart = text.lastIndexOf('\n', pos);
      const lineEnd = text.indexOf('\n', pos + title.length);
      const line = text.substring(lineStart + 1, lineEnd === -1 ? undefined : lineEnd).trim();
      if (/^(?:next|previous)\s*[:\-]?\s*/i.test(line) || /download\s*pdf/i.test(line)) {
        pos = text.indexOf(title, pos + title.length);
        continue;
      }
      return pos;
    }
    return -1;
  };

  const BACKMATTER_TITLES = ['abbreviations', 'bibliography', 'model questions', 'index', 'references'];
  const cleanOutline = outline
    .map(c => ({ title: c.title.trim(), subtopics: (c.subtopics || []).map(t => t.trim()).filter(Boolean) }))
    .filter(c => c.title && !BACKMATTER_TITLES.some(bt => c.title.toLowerCase().includes(bt)));

  const chapterMatchs = cleanOutline.map(c => {
    let idx = findChapterIndex(text, c.title, contentStartIndex);
    if (idx === -1) {
      const regexStr = c.title.split(/\s+/).map(escapeRegExp).join('\\s+');
      const regex = new RegExp(regexStr, 'i');
      const match = text.substring(contentStartIndex).match(regex);
      if (match && match.index !== undefined) idx = contentStartIndex + match.index;
    }
    return { outline: c, idx };
  }).filter(m => m.idx !== -1).sort((a, b) => a.idx - b.idx);
  
  for (let i = 0; i < chapterMatchs.length; i++) {
    const match = chapterMatchs[i];
    const nextMatch = i + 1 < chapterMatchs.length ? chapterMatchs[i+1] : null;
    
    let chapterEnd = nextMatch ? nextMatch.idx : text.length;
    let chapterContent = text.substring(match.idx, chapterEnd).trim();
    
    chapterContent = chapterContent.replace(/^(?:[\s\n]*download\s*pdf[\s\n\d]*|[\s\n]*←\s*previous:.*|[\s\n]*next:\s*→?.*?[\n\r]+)/i, '').trim();
    
    let chapterRegex = new RegExp(`^${match.outline.title.split(/\s+/).map(escapeRegExp).join('\\s+')}`, 'i');
    chapterContent = chapterContent.replace(chapterRegex, '').trim();

    const chapId = uuidv4();
    const subtopics: Chapter[] = [];
    let mainContent = chapterContent;
    let exerciseContent = '';

    // Extract Exercise block if it exists
    const exerciseRegex = /\n\s*(?:Exercise|Exercises|Practice)\b/i; 
    const exerciseMatch = chapterContent.match(exerciseRegex);
    if (exerciseMatch && exerciseMatch.index !== undefined) {
      mainContent = chapterContent.substring(0, exerciseMatch.index).trim();
      exerciseContent = chapterContent.substring(exerciseMatch.index).trim();
    }

    // --- ULTRA-FLEXIBLE REGEX TRIAL ---
    const subtopicRegex = /\n\s*([a-zA-Z]\.\s*[A-Z][A-Za-z0-9\s'\-]+|[\d]+\.\d+\s*[A-Z][A-Za-z0-9\s]+|[ivx]+\.\s*[A-Z][A-Za-z0-9\s]+):?/g;
    let matchArr;
    const sections: { title: string, start: number, end: number }[] = [];
    
    while ((matchArr = subtopicRegex.exec(mainContent)) !== null) {
        sections.push({ title: matchArr[1].trim(), start: matchArr.index, end: -1 });
    }

    // If Regex matched subtopics, use them
    if (sections.length > 0) {
        for (let k = 0; k < sections.length; k++) {
            const nextSection = sections[k + 1];
            sections[k].end = nextSection ? nextSection.start : mainContent.length;
        }

        for (const sec of sections) {
            let secContent = mainContent.substring(sec.start, sec.end).trim();
            const titleRegex = new RegExp(`^${sec.title.split(/\s+/).map(escapeRegExp).join('\\s+')}`, 'i');
            secContent = secContent.replace(titleRegex, '').trim();

            if (secContent.length > 10) {
                subtopics.push({
                    id: uuidv4(), chapterNumber: subtopics.length + 1,
                    title: sec.title, summary: '',
                    content: secContent, isGenerating: false,
                    parentId: chapId, sortOrder: sortCounter++,
                    type: 'topic', children: []
                });
            }
        }
    } 
    // --- DEEPSEEK FALLBACK (Triggered if Regex finds nothing) ---
    else if (mainContent.length > 200 && !mainContent.includes("Subject:") && !mainContent.includes("Class:")) {
        try {
            const aiPrompt = `
                Analyze the following textbook chapter text. 
                1. Extract the main introductory text (the paragraphs before the first sub-heading).
                2. Extract all sub-headings (like a. Abacus, b. Napier's Bone, 1.1 Introduction).
                3. For each sub-heading, return the exact text that belongs to that section.
                
                Return ONLY a JSON object in this format:
                {
                    "mainIntro": "The full text of the main introduction...",
                    "subTopics": [
                        { "title": "a. Abacus", "content": "The exact text under Abacus..." },
                        { "title": "b. Napier's Bone", "content": "The exact text under Napier's Bone..." }
                    ]
                }
                
                Chapter Text:
                ${mainContent.substring(0, 70000)}
            `;
            
            const aiResponseRaw = await callLLM(aiPrompt, undefined, 'json_object');
            const aiResponse = JSON.parse(aiResponseRaw);
            
            // Update mainContent to the AI extracted introduction
            mainContent = aiResponse.mainIntro || mainContent;

            // Push AI extracted subtopics
            if (aiResponse.subTopics && aiResponse.subTopics.length > 0) {
                for (const aiSub of aiResponse.subTopics) {
                    subtopics.push({
                        id: uuidv4(), chapterNumber: subtopics.length + 1,
                        title: aiSub.title, summary: '',
                        content: aiSub.content, isGenerating: false,
                        parentId: chapId, sortOrder: sortCounter++,
                        type: 'topic', children: []
                    });
                }
            }
        } catch (err) {
            console.warn("DeepSeek sub-topic extraction failed for chapter", match.outline.title, err);
            // Ultimate fallback: Push a single massive topic to prevent losing text
            subtopics.push({
                id: uuidv4(), chapterNumber: 1,
                title: `${match.outline.title} - Full Content`,
                summary: '',
                content: mainContent, isGenerating: false,
                parentId: chapId, sortOrder: sortCounter++,
                type: 'topic', children: []
            });
        }
    }
    // --------------------------------------------

    // Push Exercise node if it exists
    if (exerciseContent) {
      subtopics.push({
        id: uuidv4(), chapterNumber: subtopics.length + 1,
        title: 'Chapter Exercises', summary: '',
        content: exerciseContent, isGenerating: false,
        parentId: chapId, sortOrder: sortCounter++,
        type: 'exercise', children: []
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
// Main document processing pipeline
// ---------------------------------------------------------------------------

/**
 * Full pipeline: extract → preprocess → AI Outline → Content Split
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
  // Step A: Extract & Sanitize (unchanged)
  // --------------------------------------------------------------------------
  onProgress('Extracting text…');
  const rawText = await extractTextFromFile(file, onProgress);
  let sanitizedText = rawText.replace(/\x00/g, '');
  if (sanitizedText.trim().length === 0) {
    throw new Error('No readable text found in this document.');
  }
  onProgress('Preprocessing text…');
  sanitizedText = stripFrontMatter(sanitizedText);
  sanitizedText = stripRepeatingHeaders(sanitizedText);
  const processedText = preprocessText(sanitizedText, options);

  let finalChapters: Chapter[] = [];

  // --------------------------------------------------------------------------
  // Step B: Semantic AI Chapter Splitter (DeepSeek identifies chapter boundaries)
  // --------------------------------------------------------------------------
  onProgress('Analyzing document chapter structure with AI…');
  
  let chapterChunks: { title: string; content: string }[] = [];
  try {
    const aiPrompt = `
You are a document structural analyzer. The text provided is a full textbook.
Your task is to output a JSON array of chapter segments. Each segment MUST have:
- "title": The exact heading of the chapter (e.g., "Unit 1: Introduction To Computer", "Chapter 2: History Of Computer").
- "content": The EXACT original raw text of that chapter from the start of the heading to the end of the chapter (just before the next heading).

STRICT RULES:
1. DO NOT summarize or modify ANY text. Copy it verbatim.
2. Identify the correct starting point of the first chapter. Ignore the Table of Contents, Preface, Abbreviations, Model Questions, and Bibliography.
3. Each chapter's content must be self-contained. The sum of all chapter contents must equal the original raw text, minus the ignored front/back matter.

Text:
${processedText}

Output only the JSON array, no other text.
    `;
    
    const rawResponse = await callLLM(aiPrompt, undefined, 'json_object', 131072);
    // Clean and parse JSON
    let cleaned = rawResponse.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      chapterChunks = parsed;
      onProgress(`Semantic AI detected ${chapterChunks.length} chapter boundaries.`);
    } else {
        throw new Error('AI returned empty or invalid JSON array');
    }
  } catch (err) {
    console.warn('Semantic AI Chapter Split failed. Falling back to regex splitter.', err);
    onProgress('AI Chapter Split failed. Using regex fallback...');
    const regexChunks = splitIntoChaptersEnhanced(processedText);
    chapterChunks = regexChunks.map(ch => ({ title: ch.title, content: ch.content }));
  }

  // --------------------------------------------------------------------------
  // Step C: Process each chapter chunk using existing AI sub-topic splitter
  // --------------------------------------------------------------------------
  onProgress(`Processing ${chapterChunks.length} chapters via parallel AI for sub-topics…`);

  const limit = createConcurrencyLimit(MAX_CONCURRENCY);
  const chapterResults: Chapter[] = [];

  const jobs = chapterChunks.map((chunk, index) =>
    limit(async () => {
      onProgress(`Extracting subtopics for: ${chunk.title}…`);
      const baseSort = index * 1000;
      let localSort = 1;
      try {
        // Pass the chunk to your existing AI sub-topic extractor
        const result = await extractChapterViaAI(chunk.content, chunk.title);
        if (result) {
          const chapId = uuidv4();
          const subtopics: Chapter[] = [];
          
          // Process subtopics
          for (const sub of result.subtopics) {
            subtopics.push({
              id: uuidv4(),
              chapterNumber: subtopics.length + 1,
              title: sub.title,
              summary: '',
              content: sub.content,
              isGenerating: false,
              parentId: chapId,
              sortOrder: baseSort + (localSort++),
              type: 'topic',
              children: []
            });
          }
          
          // Process exercises
          for (const ex of result.exercises) {
            subtopics.push({
              id: uuidv4(),
              chapterNumber: subtopics.length + 1,
              title: ex.title,
              summary: '',
              content: ex.content,
              isGenerating: false,
              parentId: chapId,
              sortOrder: baseSort + (localSort++),
              type: 'exercise',
              children: []
            });
          }
          
          chapterResults.push({
            id: chapId,
            chapterNumber: index + 1,
            title: chunk.title,
            summary: '',
            content: '',
            isGenerating: false,
            parentId: null,
            sortOrder: baseSort,
            type: 'chapter',
            children: subtopics
          });
        } else {
          // If AI sub-topic extraction fails, just use the raw chapter text
          const chapId = uuidv4();
          const fallbackTopic: Chapter = {
            id: uuidv4(),
            chapterNumber: 1,
            title: 'Full Chapter Content',
            summary: '',
            content: chunk.content,
            isGenerating: false,
            parentId: chapId,
            sortOrder: baseSort + (localSort++),
            type: 'topic',
            children: []
          };
          chapterResults.push({
            id: chapId,
            chapterNumber: index + 1,
            title: chunk.title,
            summary: '',
            content: '',
            isGenerating: false,
            parentId: null,
            sortOrder: baseSort,
            type: 'chapter',
            children: [fallbackTopic]
          });
        }
      } catch (err) {
        // Fallback on any chapter error
        const chapId = uuidv4();
        const fallbackTopic: Chapter = {
          id: uuidv4(),
          chapterNumber: 1,
          title: 'Full Chapter Content',
          summary: '',
          content: chunk.content,
          isGenerating: false,
          parentId: chapId,
          sortOrder: baseSort + (localSort++),
          type: 'topic',
          children: []
        };
        chapterResults.push({
          id: chapId,
          chapterNumber: index + 1,
          title: chunk.title,
          summary: '',
          content: '',
          isGenerating: false,
          parentId: null,
          sortOrder: baseSort,
          type: 'chapter',
          children: [fallbackTopic]
        });
      }
    })
  );

  await Promise.all(jobs);

  chapterResults.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  finalChapters = chapterResults;

  // --------------------------------------------------------------------------
  // Post‑processing & Deep Metadata Generation (unchanged)
  // --------------------------------------------------------------------------
  onProgress(`Processing ${finalChapters.length} sections into hierarchy…`);
  finalChapters = cleanAcademicPaperHierarchy(finalChapters);
  finalChapters.forEach(ch => { ch.isGenerating = false; });
  callbacks?.onDiscovered?.(finalChapters);

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

  let sortOrderCounter = 0;
  for (const root of finalChapters) {
    root.sortOrder = sortOrderCounter++;
  }

  onProgress('Done.');
  return finalChapters;
}