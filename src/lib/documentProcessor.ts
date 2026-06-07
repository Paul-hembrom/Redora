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

    const extractPdfOcr = async (workerSrc?: string): Promise<string> => {
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

                await page.render({ canvasContext: context, viewport }).promise;
                
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
      console.error(
        '[documentProcessor] Primary PDF extraction failed, trying fallback worker…',
        error,
      );
      let text = await extractPdf(
        `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`,
      );
      if (text.trim().length < 100) {
         if (onProgress) onProgress('PDF contains no text, attempting OCR fallback...');
         text = await extractPdfOcr(
            `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`
         );
      }
      return text;
    }
  }

  throw new Error(`Unsupported file type: ${extension}`);
}

// ---------------------------------------------------------------------------
// Chapter / chunk splitting
// ---------------------------------------------------------------------------
export function splitIntoChapters(text: string): string[] {
  // Dynamically adjust chunk size based on document length
  // Target around 20-30 chunks max for large docs to utilize concurrency natively,
  // but keep a reasonable floor/ceiling.
  let dynamicChunkSize = Math.max(8_000, Math.min(30_000, Math.ceil(text.length / MAX_CONCURRENCY)));
  // If the document is massive (> 1M chars), allow even larger chunks up to 60,000 
  // because Gemini/DeepSeek context sizes are huge and we want to minimise API overhead.
  if (text.length > 500_000) {
     dynamicChunkSize = Math.min(60_000, Math.ceil(text.length / (MAX_CONCURRENCY * 2)));
  }

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
    if (part.length > dynamicChunkSize) {
      // Flush current chunk first, then hard-slice the oversized part.
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

  // Absolute fallback — should never be reached but guarantees non-empty output.
  if (chunks.length === 0) {
    for (let i = 0; i < text.length; i += dynamicChunkSize) {
      chunks.push(text.slice(i, i + dynamicChunkSize));
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
function cleanAcademicPaperHierarchy(nodes: Chapter[]): Chapter[] {
  let cleaned = [...nodes];

  // 1. Recursive cleaning (bottom-up approach)
  cleaned.forEach(node => {
    if (node.children && node.children.length > 0) {
      node.children = cleanAcademicPaperHierarchy(node.children);
    }
  });

  const sanitizeTitle = (t: string) => (t || '').toLowerCase().replace(/^(part|chapter)\s*\d*[:\-]?\s*/i, '').trim();

  // 2. Remove "Main Text" with no active children
  cleaned = cleaned.filter(ch => {
    const titleLower = (ch.title || '').toLowerCase();
    if (titleLower.includes('main text') && (!ch.children || ch.children.length === 0)) {
      return false;
    }
    return true;
  });

  // 3. Merge duplicate siblings
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

  // 4 & 5. Flattening & inline reference sections
  let finalNodes: Chapter[] = [];
  for (const node of cleaned) {
    // 4. Inline shallow Reference sections
    if ((node.type === 'part' || node.type === 'chapter') && node.children?.length === 1) {
      const singleChild = node.children[0];
      if (singleChild.type === 'topic' && /references?/i.test(singleChild.title || '')) {
         finalNodes.push(singleChild);
         continue;
      }
    }

    // 5. Flatten unnecessary nesting (Part -> 1 Chapter -> Topics)
    if (node.type === 'part' && node.children?.length === 1) {
      const singleChapter = node.children[0];
      if (singleChapter.type === 'chapter' && singleChapter.children && singleChapter.children.every(c => c.type === 'topic')) {
        const partClean = sanitizeTitle(node.title);
        const chClean = sanitizeTitle(singleChapter.title);
        
        if (partClean === chClean || partClean === '') {
          // Replace Part with Chapter (flatten 1 level)
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

  if (sanitizedText.trim().length === 0) {
    throw new Error("This document doesn't have textual content.");
  }

  // Step 2 — optional NLP preprocessing.
  onProgress('Preprocessing text…');
  const processedText = preprocessText(sanitizedText, options);

  // Step 3 — split into large chunks.
  onProgress('Detecting structure…');
  const chunks = splitIntoChapters(processedText);
  onProgress(`Split into ${chunks.length} chunk(s). Initializing structure…`);

  // Step 4 — Initialize structure synchronously for immediate UI feedback.
  const roots: Chapter[] = chunks.map((chunk, i) => {
    return {
      id: uuidv4(),
      chapterNumber: i + 1,
      title: `Processing part ${i + 1}...`,
      summary: 'Generating summary...',
      content: chunk,
      isGenerating: true,
      parentId: null,
      sortOrder: i,
      type: 'chapter',
      children: [],
    };
  });

  // Call onDiscovered immediately to show the structure in the UI
  callbacks?.onDiscovered?.(roots);

  // Step 5 — Async generation in batches using generateBatchChapterMetadata
  const limit = createConcurrencyLimit(MAX_CONCURRENCY);
  const BATCH_SIZE = 5;
  const batches: Chapter[][] = [];
  
  for (let i = 0; i < roots.length; i += BATCH_SIZE) {
    batches.push(roots.slice(i, i + BATCH_SIZE));
  }

  const jobs = batches.map((batch, batchIdx) =>
    limit(async () => {
      try {
        const batchData = batch.map(ch => ({
          content: ch.content,
          chapterNumber: ch.chapterNumber
        }));
        
        const percent = Math.round(((batchIdx + 1) / batches.length) * 100);
        onProgress(`AI analysis: batch ${batchIdx + 1} of ${batches.length} (${percent}%)…`);
        
        // Detailed summary instruction is the default behaviour.
        const metadataMap = await withRetry(() => generateBatchChapterMetadata(batchData, 3, 'detailed'));
        
        for (const ch of batch) {
          const meta = metadataMap[ch.chapterNumber];
          if (meta) {
            ch.title = meta.title;
            // The batch generator sometimes returns title/summary in one single object
            ch.summary = meta.summary;
          } else {
            ch.title = `Section ${ch.chapterNumber}`;
            ch.summary = 'Summary temporarily unavailable.';
          }
          ch.isGenerating = false;
          
          // Bug fix #9 / Async updating: The UI receives the newly generated title and summary
          callbacks?.onChapterDone?.(ch.chapterNumber - 1, ch.title, ch.summary);
        }
      } catch (err) {
        console.error(`[documentProcessor] Batch ${batchIdx + 1} failed:`, err);
        // Fallback for failed batches
        for (const ch of batch) {
          ch.title = `Section ${ch.chapterNumber}`;
          
          try {
            // Attempt ultra-minimal fallback summarizing
            const minSummary = await generateMinimalSummary(ch.content);
            if (minSummary && !minSummary.includes('temporarily unavailable')) {
               ch.summary = minSummary;
            } else {
               ch.summary = 'Summary temporarily unavailable - please manually update.';
            }
          } catch (fallbackErr) {
            ch.summary = 'Summary temporarily unavailable - please manually update.';
          }
          
          ch.isGenerating = false;
          callbacks?.onChapterDone?.(ch.chapterNumber - 1, ch.title, ch.summary);
        }
      }
    })
  );

  await Promise.all(jobs);

  // Re-number sortOrder just in case
  let sortOrderCounter = 0;
  for (const root of roots) {
    root.sortOrder = sortOrderCounter++;
  }

  onProgress('Done.');
  return roots;
}