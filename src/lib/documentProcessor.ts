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
} from './gemini';

// ---------------------------------------------------------------------------
// PDF.js worker setup
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;
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
const MAX_CHUNK_SIZE = 25_000;

/** Maximum concurrent AI hierarchy API calls (used only for fallback single calls) */
const MAX_CONCURRENCY = 3;

/** Maximum number of retry attempts for rate-limited or transient errors. */
const MAX_RETRIES = 4;

/** Base delay (ms) for exponential backoff. */
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
// Retry wrapper – now covers transient errors (rate limit + 503/network)
// ---------------------------------------------------------------------------
function isTransientError(err: unknown): boolean {
  if (err instanceof ApiRateLimitError) return true;
  // Check for common HTTP transient error codes
  if (err instanceof Error && err.message) {
    const msg = err.message;
    return /\b(?:503|429|502|504)\b/.test(msg) || /service unavailable/i.test(msg);
  }
  return false;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = MAX_RETRIES,
  baseDelayMs = BACKOFF_BASE_MS,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransientError(err) || attempt === maxRetries) throw err;

      const delay =
        err instanceof ApiRateLimitError && (err as ApiRateLimitError).retryAfterMs
          ? (err as ApiRateLimitError).retryAfterMs
          : baseDelayMs * Math.pow(2, attempt);
      console.warn(
        `[documentProcessor] Transient error – retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }
  // Unreachable but required by TS
  throw new Error('withRetry: unreachable');
}

// ---------------------------------------------------------------------------
// File text extraction
// ---------------------------------------------------------------------------
export async function extractTextFromFile(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  // ------------------------------------------------------------------
  // Plain text
  // ------------------------------------------------------------------
  if (extension === 'txt') {
    const buf = await file.arrayBuffer();
    return new TextDecoder().decode(buf);
  }

  // ------------------------------------------------------------------
  // EPUB – using correct spineItems API
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // DOCX
  // ------------------------------------------------------------------
  if (extension === 'docx') {
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return result.value;
  }

  // ------------------------------------------------------------------
  // Images
  // ------------------------------------------------------------------
  if (['jpg', 'jpeg', 'png', 'webp'].includes(extension ?? '')) {
    if (onProgress) onProgress('Extracting text from image using AI…');
    const buf = await file.arrayBuffer();
    const base64Data = btoa(
      new Uint8Array(buf).reduce((data, byte) => data + String.fromCharCode(byte), ''),
    );
    const mimeType = file.type || `image/${extension === 'jpg' ? 'jpeg' : extension}`;
    return extractTextFromImage(base64Data, mimeType);
  }

  // ------------------------------------------------------------------
  // PDF – streaming via blob URL to avoid huge ArrayBuffer
  // ------------------------------------------------------------------
  if (extension === 'pdf') {
    const extractPdf = async (workerSrc?: string): Promise<string> => {
      if (workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
      }

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

    try {
      return await extractPdf();
    } catch (error) {
      console.error(
        '[documentProcessor] Primary PDF extraction failed, trying fallback worker…',
        error,
      );
      return extractPdf(
        `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`,
      );
    }
  }

  throw new Error(`Unsupported file type: ${extension}`);
}

// ---------------------------------------------------------------------------
// Chapter / chunk splitting – improved to avoid single‑line chunks
// ---------------------------------------------------------------------------
export function splitIntoChapters(text: string): string[] {
  // Try common chapter/section headers first.
  const chapterRegex = /\n(?=(?:Chapter|Section|Part)\s+[0-9IVX]+)/gi;
  const originalSplits = text.split(chapterRegex).filter(s => s.trim().length > 100);

  let parts = originalSplits.length > 1 ? originalSplits : text.split(/\n\s*\n/);

  // If we still have too few parts, don't split on every newline – just do fixed‑size chunks.
  if (parts.length < 5 && originalSplits.length <= 1) {
    parts = []; // fall back to fixed‑size slicing below
  }

  const chunks: string[] = [];
  let currentChunk = '';

  // If we have meaningful parts, merge them respecting MAX_CHUNK_SIZE.
  if (parts.length > 0) {
    for (const part of parts) {
      if (part.length > MAX_CHUNK_SIZE) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
        for (let i = 0; i < part.length; i += MAX_CHUNK_SIZE) {
          chunks.push(part.slice(i, i + MAX_CHUNK_SIZE));
        }
      } else if (
        currentChunk.length + part.length > MAX_CHUNK_SIZE &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk);
        currentChunk = part;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + part;
      }
    }
    if (currentChunk) chunks.push(currentChunk);
  } else {
    // No structural breaks – just slice by MAX_CHUNK_SIZE.
    for (let i = 0; i < text.length; i += MAX_CHUNK_SIZE) {
      chunks.push(text.slice(i, i + MAX_CHUNK_SIZE));
    }
  }

  // Guarantee non‑empty output.
  if (chunks.length === 0) {
    chunks.push(text);
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Hierarchy parsing – now assigns content correctly to chapters
// ---------------------------------------------------------------------------

/**
 * Parses a single hierarchy object returned by the AI and pushes Chapter records.
 * Content is placed on the chapter level; topics and parts get empty content
 * to avoid duplication and oversized summaries.
 */
function parseHierarchyIntoChapters(
  hierarchy: any,
  chunk: string,
  allChapters: Chapter[],
  baseSortOrder: number, // guaranteed unique across chunks
  chunkIndex: number,
): void {
  if (!hierarchy || typeof hierarchy !== 'object') {
    throw new Error('Invalid hierarchy format');
  }

  let localCounter = baseSortOrder;

  if (hierarchy.parts && Array.isArray(hierarchy.parts)) {
    hierarchy.parts.forEach((part: any, pIdx: number) => {
      const partId = uuidv4();
      allChapters.push({
        id: partId,
        chapterNumber: pIdx + 1,
        title: part.title || `Part ${pIdx + 1}`,
        summary: part.summary || '',
        content: '', // parts are structural only
        isGenerating: false,
        parentId: null,
        sortOrder: localCounter++,
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
            summary: chap.summary || '',
            content: chunk, // full chunk for the chapter (contains all its topics)
            isGenerating: false,
            parentId: partId,
            sortOrder: localCounter++,
            type: 'chapter',
            children: [],
          });

          if (chap.topics && Array.isArray(chap.topics)) {
            chap.topics.forEach((topic: any, tIdx: number) => {
              allChapters.push({
                id: uuidv4(),
                chapterNumber: tIdx + 1,
                title: topic.title || `Topic ${tIdx + 1}`,
                summary: topic.summary || '',
                content: '', // topics inherit context from parent chapter
                isGenerating: false,
                parentId: chapId,
                sortOrder: localCounter++,
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
        summary: chap.summary || '',
        content: chunk, // chapter owns the text
        isGenerating: false,
        parentId: null,
        sortOrder: localCounter++,
        type: 'chapter',
        children: [],
      });

      if (chap.topics && Array.isArray(chap.topics)) {
        chap.topics.forEach((topic: any, tIdx: number) => {
          allChapters.push({
            id: uuidv4(),
            chapterNumber: tIdx + 1,
            title: topic.title || `Topic ${tIdx + 1}`,
            summary: topic.summary || '',
            content: '', // content resides in parent chapter
            isGenerating: false,
            parentId: chapId,
            sortOrder: localCounter++,
            type: 'topic',
            children: [],
          });
        });
      }
    });
    return;
  }

  // Top‑level topics (rare) – assign empty content to avoid duplication;
  // the caller may later inject the chunk.
  if (hierarchy.topics && Array.isArray(hierarchy.topics)) {
    hierarchy.topics.forEach((topic: any, tIdx: number) => {
      allChapters.push({
        id: uuidv4(),
        chapterNumber: tIdx + 1,
        title: topic.title || `Topic ${tIdx + 1}`,
        summary: topic.summary || '',
        content: '', // cannot reliably split the chunk
        isGenerating: false,
        parentId: null,
        sortOrder: localCounter++,
        type: 'topic',
        children: [],
      });
    });
    return;
  }

  throw new Error('Hierarchy contained no parts, chapters, or topics');
}

// ---------------------------------------------------------------------------
// Main document processing pipeline
// ---------------------------------------------------------------------------
export async function processDocument(
  file: File,
  options: PreprocessOptions,
  onProgress: (msg: string) => void,
  callbacks?: {
    onDiscovered?: (chapters: Chapter[]) => void;
    onChapterDone?: (index: number, title: string, summary: string) => void;
  },
): Promise<Chapter[]> {
  // Step 1 – extract raw text (streaming‑safe for PDFs)
  onProgress('Extracting text…');
  const rawText = await extractTextFromFile(file, onProgress);

  // Step 2 – optional preprocessing
  onProgress('Preprocessing text…');
  const processedText = preprocessText(rawText, options);

  // Step 3 – split into ≤25k‑char chunks
  onProgress('Detecting structure…');
  const chunks = splitIntoChapters(processedText);
  onProgress(`Split into ${chunks.length} chunk(s). Analysing with AI…`);

  const allChapters: Chapter[] = [];

  // Step 4 – Use batch API when possible; fall back to individual calls.
  if (chunks.length > 1) {
    // BATCH PATH
    onProgress(`Requesting structure for all ${chunks.length} chunks in one batch…`);
    let hierarchies: any[];
    try {
      hierarchies = await withRetry(() => generateBatchChapterMetadata(chunks, 3));
    } catch (err) {
      console.error('[documentProcessor] Batch AI call failed:', err);
      // Fallback: treat each chunk as a single unnamed section.
      chunks.forEach((chunk, i) => {
        const fallback: Chapter = {
          id: uuidv4(),
          chapterNumber: i + 1,
          title: `Section ${i + 1}`,
          summary: 'Structure extraction failed',
          content: chunk,
          isGenerating: false,
          parentId: null,
          sortOrder: i * 10000,
          type: 'chapter',
          children: [],
        };
        allChapters.push(fallback);
        callbacks?.onChapterDone?.(i, fallback.title, fallback.summary);
      });
      return allChapters; // return flat list; caller may still build a tree
    }

    // Parse each hierarchy in order, assigning unique sort orders.
    chunks.forEach((chunk, i) => {
      const baseSort = i * 10000; // large enough gap to avoid collisions
      const chaptersBefore = allChapters.length;
      try {
        parseHierarchyIntoChapters(hierarchies[i], chunk, allChapters, baseSort, i);
      } catch (parseErr) {
        console.error(`[documentProcessor] Chunk ${i + 1} parse error:`, parseErr);
        // fallback for this chunk
        const fallback: Chapter = {
          id: uuidv4(),
          chapterNumber: i + 1,
          title: `Section ${i + 1}`,
          summary: 'Failed to parse structure',
          content: chunk,
          isGenerating: false,
          parentId: null,
          sortOrder: baseSort,
          type: 'chapter',
          children: [],
        };
        allChapters.push(fallback);
      }

      // Fire onChapterDone for new top‑level items from this chunk
      const newChapters = allChapters.slice(chaptersBefore);
      newChapters
        .filter(ch => ch.parentId === null)
        .forEach((ch, idx) => {
          callbacks?.onChapterDone?.(chaptersBefore + idx, ch.title, ch.summary);
        });
    });
  } else {
    // SINGLE CHUNK PATH (chunks.length === 1 or 0)
    // Use concurrency limiter (only one job) but keep the flow consistent.
    const limit = createConcurrencyLimit(MAX_CONCURRENCY);
    const chunk = chunks[0] || '';

    await limit(async () => {
      let hierarchy: any;
      try {
        hierarchy = await withRetry(() => generateDocumentHierarchy(chunk, 3));
      } catch (err) {
        console.error('[documentProcessor] Single chunk AI analysis failed:', err);
        allChapters.push({
          id: uuidv4(),
          chapterNumber: 1,
          title: 'Section 1',
          summary: 'Structure extraction failed',
          content: chunk,
          isGenerating: false,
          parentId: null,
          sortOrder: 0,
          type: 'chapter',
          children: [],
        });
        callbacks?.onChapterDone?.(0, 'Section 1', 'Structure extraction failed');
        return;
      }

      try {
        parseHierarchyIntoChapters(hierarchy, chunk, allChapters, 0, 0);
      } catch (parseErr) {
        console.error('[documentProcessor] Single chunk parse error:', parseErr);
        allChapters.push({
          id: uuidv4(),
          chapterNumber: 1,
          title: 'Section 1',
          summary: 'Failed to parse structure',
          content: chunk,
          isGenerating: false,
          parentId: null,
          sortOrder: 0,
          type: 'chapter',
          children: [],
        });
      }

      // Fire onChapterDone for the new top‑level items (usually one)
      const newChapters = allChapters.filter(ch => ch.parentId === null);
      newChapters.forEach((ch, idx) => {
        callbacks?.onChapterDone?.(idx, ch.title, ch.summary);
      });
    });
  }

  // Step 5 – Build tree from flat list (parentId links).
  const chapterMap = new Map<string, Chapter>();
  // Sort by sortOrder so children are inserted correctly.
  allChapters
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach(ch => {
      chapterMap.set(ch.id, { ...ch, children: [] });
    });

  const roots: Chapter[] = [];
  for (const ch of chapterMap.values()) {
    if (ch.parentId && chapterMap.has(ch.parentId)) {
      chapterMap.get(ch.parentId)!.children!.push(ch);
    } else {
      roots.push(ch);
    }
  }

  callbacks?.onDiscovered?.(roots);
  onProgress('Done.');
  return roots;
}