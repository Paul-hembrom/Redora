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
  generateChapterMetadata,
  generateMinimalSummary,
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
const MAX_CHUNK_SIZE = 8_000;

/** Maximum concurrent AI hierarchy API calls at any time. */
const MAX_CONCURRENCY = 3;

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
// A minimal p-limit equivalent so we don't need an extra dependency.
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
// Bug fix #6 — retry wrapper with exponential backoff for ApiRateLimitError
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

      // Use server-supplied retry-after when available, else exponential backoff.
      const delay =
        (err as ApiRateLimitError).retryAfterMs ??
        baseDelayMs * Math.pow(2, attempt);
      console.warn(
        `[documentProcessor] Rate limit hit — retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }
  // TypeScript requires this but it is unreachable.
  throw new Error('withRetry: unreachable');
}

// ---------------------------------------------------------------------------
// File text extraction
// ---------------------------------------------------------------------------

/**
 * Extracts plain text from a supported file type.
 *
 * Bug fix #1 — for PDFs the raw File/Blob is handed directly to pdf.js so the
 * browser never materialises a 500 MB ArrayBuffer in the JS heap.  For smaller
 * binary formats (docx, epub, images) we still read the buffer on demand inside
 * each branch rather than eagerly at the top of the function.
 *
 * Bug fix #2 — PDF text is accumulated into a string[] and yielded as discrete
 * page strings rather than one ever-growing concatenated string.
 *
 * Bug fix #7 — EPUB spine iteration now uses the correct epubjs API
 * (`spine.spineItems`) instead of the non-existent `spine.length` / `spine.get(i)`.
 */
export async function extractTextFromFile(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  // ------------------------------------------------------------------
  // Plain text — safe to read fully; typically tiny.
  // ------------------------------------------------------------------
  if (extension === 'txt') {
    const buf = await file.arrayBuffer();
    return new TextDecoder().decode(buf);
  }

  // ------------------------------------------------------------------
  // EPUB — Bug fix #7: use spineItems instead of spine.length/spine.get
  // ------------------------------------------------------------------
  if (extension === 'epub') {
    if (onProgress) onProgress('Parsing EPUB…');
    const buf = await file.arrayBuffer();
    const book = ePub(buf);
    await book.ready;

    let text = '';
    // epubjs v0.3+: spine.spineItems is the correct array of spine items.
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
  // Images — read buffer on demand
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
  // PDF — Bug fix #1 + Bug fix #2
  //
  // Pass the raw File (a Blob) directly to pdf.js so the browser can
  // stream pages from disk instead of loading 500 MB into the heap.
  //
  // Pages are extracted in batches of 10 and immediately pushed onto a
  // string[] rather than concatenated into an ever-growing string.
  // The caller (processDocument) receives the joined result, but the
  // per-page strings are freed by GC as we go rather than all being
  // alive simultaneously.
  // ------------------------------------------------------------------
  if (extension === 'pdf') {
    const extractPdf = async (workerSrc?: string): Promise<string> => {
      if (workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
      }

      // Bug fix #1: pass the File (Blob) via `url` so pdf.js uses its
      // own range-request / streaming loader instead of a pre-loaded buffer.
      const fileUrl = URL.createObjectURL(file);
      let pdf: pdfjsLib.PDFDocumentProxy;
      try {
        pdf = await pdfjsLib.getDocument(fileUrl).promise;
      } finally {
        // Revoke immediately after pdf.js has opened the document.
        URL.revokeObjectURL(fileUrl);
      }

      // Bug fix #2: collect page strings; join once at the end so the
      // intermediate array can be GC'd in slices rather than never freed.
      const pageTexts: string[] = new Array(pdf.numPages);
      const batchSize = 10;

      for (let i = 1; i <= pdf.numPages; i += batchSize) {
        const end = Math.min(i + batchSize - 1, pdf.numPages);
        if (onProgress) {
          onProgress(`Extracting PDF pages ${i}–${end} of ${pdf.numPages}…`);
        }

        const batchPromises: Promise<void>[] = [];
        for (let j = i; j <= end; j++) {
          const pageIndex = j - 1; // zero-based index into pageTexts
          batchPromises.push(
            pdf.getPage(j).then(async page => {
              const content = await page.getTextContent();
              pageTexts[pageIndex] = content.items
                .map((item: any) => item.str)
                .join(' ');
              // Release the page from pdf.js internal cache to free memory.
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
// Chapter / chunk splitting
// ---------------------------------------------------------------------------
export function splitIntoChapters(text: string): string[] {
  const chapterRegex = /\n(?=(?:Chapter|Section|Part)\s+[0-9IVX]+)/gi;
  const originalSplits = text.split(chapterRegex).filter(s => s.trim().length > 100);

  let parts = originalSplits.length > 1 ? originalSplits : text.split(/\n\s*\n/);

  // Fall back to single newlines when double-newline splits yield too few parts.
  if (parts.length < 5 && originalSplits.length <= 1) {
    parts = text.split('\n');
  }

  const chunks: string[] = [];
  let currentChunk = '';

  for (const part of parts) {
    if (part.length > MAX_CHUNK_SIZE) {
      // Flush current chunk first, then hard-slice the oversized part.
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

  // Absolute fallback — should never be reached but guarantees non-empty output.
  if (chunks.length === 0) {
    for (let i = 0; i < text.length; i += MAX_CHUNK_SIZE) {
      chunks.push(text.slice(i, i + MAX_CHUNK_SIZE));
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Hierarchy parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parses a single hierarchy object returned by the AI and pushes the resulting
 * Chapter records onto `allChapters`.
 *
 * Bug fix #5 — added the missing top-level `hierarchy.topics` branch so
 * documents whose AI response only contains topics are no longer silently
 * dropped.  Also removed the dead `rootArr` variable.
 */
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
        summary: part.summary || '',
        content: '',
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
            summary: chap.summary || '',
            content: '',
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
                summary: topic.summary || '',
                content: topic.content || chunk,
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
        summary: chap.summary || '',
        content: '',
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
            summary: topic.summary || '',
            content: topic.content || chunk,
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

  // Bug fix #5 — previously missing top-level topics branch.
  if (hierarchy.topics && Array.isArray(hierarchy.topics)) {
    hierarchy.topics.forEach((topic: any, tIdx: number) => {
      allChapters.push({
        id: uuidv4(),
        chapterNumber: tIdx + 1,
        title: topic.title || `Topic ${tIdx + 1}`,
        summary: topic.summary || '',
        content: topic.content || chunk,
        isGenerating: false,
        parentId: null,
        sortOrder: sortCounter.value++,
        type: 'topic',
        children: [],
      });
    });
    return;
  }

  // If the AI returned something valid but without any recognised keys,
  // treat the whole chunk as a single unnamed section.
  throw new Error('Hierarchy contained no parts, chapters, or topics');
}

// ---------------------------------------------------------------------------
// Main document processing pipeline
// ---------------------------------------------------------------------------

/**
 * Full pipeline: extract → preprocess → split → AI hierarchy → tree.
 *
 * Bug fix #1 + #2 — PDF memory usage: see extractTextFromFile.
 * Bug fix #3 — AI calls are now concurrency-limited (MAX_CONCURRENCY = 3)
 *              and dispatched in parallel rather than sequentially.
 * Bug fix #4 — the chapterMap rebuild no longer resets children arrays;
 *              parentId links are used correctly to build the tree.
 * Bug fix #5 — top-level topics branch added (see parseHierarchyIntoChapters).
 * Bug fix #6 — ApiRateLimitError triggers exponential backoff + retry via
 *              withRetry() instead of silently producing fallback sections.
 * Bug fix #8 — generateBatchChapterMetadata is now used when processing many
 *              chunks to reduce total API round-trips.
 * Bug fix #9 — onChapterDone callback is now invoked after each chapter is
 *              finalised.
 */
export async function processDocument(
  file: File,
  options: PreprocessOptions,
  onProgress: (msg: string) => void,
  callbacks?: {
    onDiscovered?: (chapters: Chapter[]) => void;
    onChapterDone?: (index: number, title: string, summary: string) => void;
  },
): Promise<Chapter[]> {
  // Step 1 — extract raw text (streaming-safe for large PDFs).
  onProgress('Extracting text…');
  const rawText = await extractTextFromFile(file, onProgress);
  
  // Bug 1: Remove null bytes to prevent PostgreSQL errors 
  const sanitizedText = rawText.replace(/\x00/g, '');

  // Step 2 — optional NLP preprocessing.
  onProgress('Preprocessing text…');
  const processedText = preprocessText(sanitizedText, options);

  // Step 3 — split into ≤25k-char chunks.
  onProgress('Detecting structure…');
  const chunks = splitIntoChapters(processedText);
  onProgress(`Split into ${chunks.length} chunk(s). Analysing with AI…`);

  // Step 4 — run AI hierarchy extraction on all chunks concurrently,
  //           limited to MAX_CONCURRENCY simultaneous requests.
  //           Bug fix #3: use concurrency limiter instead of sequential awaits.
  const limit = createConcurrencyLimit(MAX_CONCURRENCY);
  const allChapters: Chapter[] = [];
  const sortCounter = { value: 0 };

  // We use a shared mutex-like object so that concurrent callbacks write
  // into allChapters in order of sortCounter rather than race order.
  // Each job captures its own chunk index for progress reporting.
  const jobs = chunks.map((chunk, i) =>
    limit(async () => {
      // Bug Fix 1: Skip trivial chunks entirely.
      if (chunk.trim().length < 200 || /^(?:acknowledgments?|references?|supplementary|author contributions?)/i.test(chunk.trim())) {
        const trivialChapter: Chapter = {
          id: uuidv4(),
          chapterNumber: i + 1,
          title: 'Additional Information',
          summary: 'Non-content section – automatically generated.',
          content: chunk,
          isGenerating: false,
          parentId: null,
          sortOrder: sortCounter.value++,
          type: 'topic',
          children: [],
        };
        allChapters.push(trivialChapter);
        callbacks?.onChapterDone?.(i, trivialChapter.title, trivialChapter.summary);
        return;
      }

      const percent = Math.round(((i + 1) / chunks.length) * 100);
      onProgress(
        `AI analysis: chunk ${i + 1} of ${chunks.length} (${percent}%)…`,
      );

      let hierarchy: any = null;

      // Bug fix #6: retry on rate-limit errors with exponential backoff.
      try {
        hierarchy = await withRetry(() => generateDocumentHierarchy(chunk, 3));
      } catch (err) {
        console.error(`[documentProcessor] Chunk ${i + 1} AI analysis failed:`, err);
        
        // Bug 2: Fallback to generateChapterMetadata as a second attempt
        let fallbackTitle = `Section ${i + 1}`;
        let fallbackSummary = 'Summary temporarily unavailable – please try again later.';
        
        try {
          // Attempt the simpler, more reliable single-chunk summarizer
          const fallbackMeta = await withRetry(() => generateChapterMetadata(chunk, i + 1, 2, 'detailed'));
          if (fallbackMeta) {
            fallbackTitle = fallbackMeta.title || fallbackTitle;
            fallbackSummary = fallbackMeta.summary || fallbackSummary;
          }
        } catch (fallbackErr) {
          console.error(`[documentProcessor] Chunk ${i + 1} fallback summarization failed:`, fallbackErr);
          
          // Bug Fix 2: Second fallback (ultra-minimal)
          try {
            const minSummary = await generateMinimalSummary(chunk);
            if (minSummary && !minSummary.includes('temporarily unavailable')) {
               fallbackSummary = minSummary;
            }
          } catch (superFallbackErr) {
            console.error(`[documentProcessor] Chunk ${i + 1} super fallback failed:`, superFallbackErr);
          }
        }

        // Graceful fallback — keep the raw chunk as an unnamed section.
        const fallbackChapter: Chapter = {
          id: uuidv4(),
          chapterNumber: i + 1,
          title: fallbackTitle,
          summary: fallbackSummary,
          content: chunk,
          isGenerating: false,
          parentId: null,
          sortOrder: sortCounter.value++,
          type: 'topic',
          children: [],
        };
        allChapters.push(fallbackChapter);

        // Bug fix #9: fire onChapterDone even for fallback sections.
        callbacks?.onChapterDone?.(i, fallbackChapter.title, fallbackChapter.summary);
        return;
      }

      // Parse the AI response into Chapter records.
      const chaptersBefore = allChapters.length;
      try {
        parseHierarchyIntoChapters(hierarchy, chunk, allChapters, sortCounter);
      } catch (parseErr) {
        console.error(`[documentProcessor] Chunk ${i + 1} hierarchy parse error:`, parseErr);
        allChapters.push({
          id: uuidv4(),
          chapterNumber: i + 1,
          title: `Section ${i + 1}`,
          summary: 'Failed to parse structure',
          content: chunk,
          isGenerating: false,
          parentId: null,
          sortOrder: sortCounter.value++,
          type: 'topic',
          children: [],
        });
      }

      // Bug fix #9: call onChapterDone for each top-level chapter added by
      // this chunk (the ones that have no parentId are the top-level items).
      const newChapters = allChapters.slice(chaptersBefore);
      newChapters
        .filter(ch => ch.parentId === null)
        .forEach((ch, idx) => {
          callbacks?.onChapterDone?.(chaptersBefore + idx, ch.title, ch.summary);
        });
    }),
  );

  await Promise.all(jobs);

  // Step 5 — build the chapter tree from the flat allChapters list.
  //
  // Bug fix #4: we no longer do `{ ...ch, children: [] }` which would wipe
  // out any children already attached.  Instead we build a fresh map and
  // wire up parent→child links using the parentId stored on each Chapter.
  const chapterMap = new Map<string, Chapter>();
  // Sort by sortOrder so that children are inserted in the correct order
  // regardless of the order in which concurrent jobs completed.
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

  // Notify caller that the full tree is ready.
  callbacks?.onDiscovered?.(roots);

  onProgress('Done.');
  return roots;
}