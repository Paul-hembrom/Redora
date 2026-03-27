import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import mammoth from 'mammoth';
import { PreprocessOptions, Chapter } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { generateChapterMetadata } from './gemini';

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

export async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  if (extension === 'txt') {
    return new TextDecoder().decode(arrayBuffer);
  }

  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (extension === 'pdf') {
    try {
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      return text;
    } catch (error) {
      console.error("Primary PDF extraction failed, trying fallback worker...", error);
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      return text;
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
  
  const chunkSize = 15000;
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function processDocument(file: File, options: PreprocessOptions, onProgress: (msg: string) => void): Promise<Chapter[]> {
  onProgress('Extracting text...');
  const rawText = await extractTextFromFile(file);
  
  onProgress('Preprocessing text...');
  const processedText = preprocessText(rawText, options);
  
  onProgress('Detecting chapters...');
  const chunks = splitIntoChapters(processedText);
  
  const chapters: Chapter[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    onProgress(`Generating metadata for Chapter ${i + 1} of ${chunks.length}...`);
    try {
      const metadata = await generateChapterMetadata(chunks[i], i + 1);
      chapters.push({
        id: uuidv4(),
        chapterNumber: i + 1,
        title: metadata.title,
        summary: metadata.summary,
        content: chunks[i]
      });
      // Add a small delay to avoid hitting Gemini API rate limits (15 RPM for free tier)
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    } catch (err: any) {
      console.error(`Failed to generate metadata for chapter ${i + 1}`, err);
      chapters.push({
        id: uuidv4(),
        chapterNumber: i + 1,
        title: `Chapter ${i + 1}`,
        summary: `Summary generation failed: ${err.message || 'Unknown error. Please check your API key and rate limits.'}`,
        content: chunks[i]
      });
    }
  }
  
  return chapters;
}
