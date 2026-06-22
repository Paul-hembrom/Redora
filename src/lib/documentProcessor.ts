import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import mammoth from 'mammoth';
import ePub from 'epubjs';
import { PreprocessOptions, Chapter } from '../types';
import { v4 as uuidv4 } from 'uuid';
import {
  extractTextFromImage,
  ApiRateLimitError,
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
// File text extraction
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
// PREPROCESSING FILTERS
// ---------------------------------------------------------------------------
export function stripFrontMatter(text: string): string {
  // Aggressively strip the first 3000 chars if it looks like cover page/filename/PDF noise.
  // For this specific book, we also look for "Page Preview 1" or "Table of Contents".
  const checkArea = text.slice(0, 3000);
  if (/computer class\s*\d+\.pdf/i.test(checkArea) || 
      /download pdf/i.test(checkArea) || 
      /eureka\s*logic/i.test(checkArea) ||
      /Page Preview/i.test(checkArea)) {
    // Try to find the first real Unit/Chapter heading to start the text
    const firstUnit = text.match(/\n\s*Unit\s+[0-9IVX]+\s+[A-Z]/i);
    if (firstUnit && firstUnit.index !== undefined) {
      return text.slice(firstUnit.index).trim();
    }
    return text.slice(3000).trim();
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
    if (/previous:/i.test(trimmed)) return false;
    if (/next:/i.test(trimmed)) return false;
    if (/download pdf\s*\d*/i.test(trimmed)) return false;
    if (/Page Preview/i.test(trimmed)) return false;
    if (/^[A-Z\s\-0-9]+\s+\d{1,3}$/i.test(trimmed) && trimmed.length > 5 && trimmed.length < 50) return false;
    if (/^eureka\s+logic/i.test(trimmed) && trimmed.length < 50) return false;
    return true;
  }).join('\n');
}

// ---------------------------------------------------------------------------
// EXACT MANUAL SPLITTER (The "Win" Logic)
// ---------------------------------------------------------------------------
export function splitIntoChaptersEnhanced(text: string, titleOffset = 0, sortCounterStart = 0): Chapter[] {
  const allChapters: Chapter[] = [];
  let sortCounter = sortCounterStart;

  // 1. Force-strip any remaining "Page Preview", "Download PDF", "Table of Contents" 
  //    AND the "Next: / Previous:" lines BEFORE we do any splitting.
  let cleanedText = text.replace(/Page\s*Preview\s*\d+/gi, '');
  cleanedText = cleanedText.replace(/Download\s*PDF\s*\d*/gi, '');
  cleanedText = cleanedText.replace(/←\s*Previous:.*/gi, '');
  cleanedText = cleanedText.replace(/Next:\s*→.*/gi, '');
  cleanedText = cleanedText.replace(/Previous:\s*.*/gi, '');
  cleanedText = cleanedText.replace(/Next:\s*.*/gi, '');

  // 2. Skip past the Table of Contents
  const tocRegex = /(?:Table\s+of\s+Contents|CONTENTS|TABLE\s+OF\s+CONTENTS)/i;
  const tocMatch = cleanedText.match(tocRegex);
  let processedText = cleanedText;
  if (tocMatch && tocMatch.index !== undefined) {
    processedText = cleanedText.slice(tocMatch.index + 4000);
  }

  // 3. Split by Main Chapters ONLY matching the exact format (Unit X: Name)
  const chapterRegex = /(?=\n\s*Unit\s+[0-9IVX]+(?:\s*[:\-]?\s*[^\n]{0,150})?)/gi;
  const evalText = processedText.startsWith('\n') ? processedText : '\n' + processedText;
  let originalSplits = evalText.split(chapterRegex).filter(s => s.trim().length > 100);

  if (originalSplits.length <= 1) {
    originalSplits = [processedText];
  }

  let chapterIndex = titleOffset + 1;

  for (const part of originalSplits) {
    let titleStr = `Section ${chapterIndex}`;
    let contentToProcess = part.trim();
    
    // Remove any leading garbage from the top of the part
    contentToProcess = contentToProcess.replace(/^(?:[\s\n]*download\s*pdf[\s\n\d]*|[\s\n]*←\s*previous:.*|[\s\n]*next:\s*→?.*?[\n\r]+)/i, '').trim();

    // Extract the title (Unit X: Name)
    const firstLineMatch = contentToProcess.match(/^(?:\s*Unit\s+[0-9IVX]+(?:\s*[:\-]?\s*[^\n]+)?)/i);
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
      }
    }

    const chapterId = uuidv4();
    const subtopics: Chapter[] = [];

    // 4. Split the chapter into sections (Subtopics: a., b., i., ii., 1., 2., etc.)
    // Also capture "Exercise", "Summary", "Technical Terms"
    const subtopicRegex = /(?=\n\s*(?:(?:[a-z]\.|[ivx]+\.)\s+[A-Z]|\d+\.\d+\s+[A-Z]|Exercise|Summary|Technical Terms|Project Work|Lab Work|Exercise\s*[\n\r]*Select\s*the\s*best\s*answer))/gi;
    const subSplits = contentToProcess.split(subtopicRegex).filter(s => s.trim().length > 20);

    if (subSplits.length > 1) {
      // Preamble (e.g., Learning Objectives, Introduction)
      const preamble = subSplits[0].trim();
      if (preamble.length > 10) {
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
      } else {
          allChapters.push({
            id: chapterId,
            chapterNumber: chapterIndex,
            title: titleStr,
            summary: '',
            content: '',
            isGenerating: false,
            parentId: null,
            sortOrder: sortCounter++,
            type: 'chapter',
            children: []
          });
      }

      // 5. Process each subtopic block
      for (let i = 1; i < subSplits.length; i++) {
        const sub = subSplits[i].trim();
        let subTitle = `Topic ${chapterIndex}.${i}`;
        
        // Extract the subtopic title
        const subFirstLineMatch = sub.match(/^(?:\d+\.\d+(?:\.\d+)*|(?:[a-z]\.|[ivx]+\.)\s+[^\n]+|Exercise|Summary|Technical Terms|Project Work|Lab Work)/i);
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

        // Determine type based on title
        let type: 'topic' | 'exercise' | 'summary' | 'glossary' = 'topic';
        const lowerTitle = subTitle.toLowerCase();
        if (lowerTitle.includes('exercise')) type = 'exercise';
        else if (lowerTitle.includes('summary')) type = 'summary';
        else if (lowerTitle.includes('technical terms')) type = 'glossary';

        subtopics.push({
          id: uuidv4(),
          chapterNumber: i,
          title: subTitle,
          summary: '',
          content: subContent,
          isGenerating: false,
          parentId: chapterId,
          sortOrder: sortCounter++,
          type: type,
          children: []
        });
      }

      // Attach subtopics to the parent chapter
      const parentChapter = allChapters.find(ch => ch.id === chapterId);
      if (parentChapter) {
          parentChapter.children = subtopics;
      }

    } else {
      // If no subtopics, push the whole thing as a single chapter
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
// Main document processing pipeline
// ---------------------------------------------------------------------------

/**
 * Full pipeline: extract → preprocess → Force Regex Split
 * Absolutely NO AI usage for the extraction logic. 
 * This guarantees the exact structure pulled directly from your book's raw text.
 */
export async function processDocument(
  file: File,
  options: PreprocessOptions,
  onProgress: (msg: string) => void,
  callbacks?: {
    onDiscovered?: (chapters: Chapter[]) => void;
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
  // We aggressively sanitize it to remove all navigation junk.
  sanitizedText = stripFrontMatter(sanitizedText);
  sanitizedText = stripRepeatingHeaders(sanitizedText);
  const processedText = preprocessText(sanitizedText, options);

  let finalChapters: Chapter[] = [];

  // --------------------------------------------------------------------------
  // Step B: Execute the Regex Parser
  // --------------------------------------------------------------------------
  onProgress('Parsing document into chapters and subtopics via Regex…');
  finalChapters = splitIntoChaptersEnhanced(processedText);
  
  // --------------------------------------------------------------------------
  // Step C: Return final structure to UI
  // --------------------------------------------------------------------------
  finalChapters.forEach(ch => { ch.isGenerating = false; });
  callbacks?.onDiscovered?.(finalChapters);

  onProgress('Done.');
  return finalChapters;
}