const fs = require('fs');
let content = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

// Update extractTextViaGeminiVision signature
content = content.replace(
  /export async function extractTextViaGeminiVision\(\n  file: File,\n  onProgress\?: \(msg: string\) => void\n\): Promise<string> \{\n  const buf = await file.arrayBuffer\(\);\n  if \(!pdfjsLib\) throw new Error\("pdfjsLib not loaded"\);\n  const pdf = await pdfjsLib.getDocument\(\{ data: buf \}\).promise;/,
  `export async function extractTextViaGeminiVision(
  pdf: any,
  onProgress?: (msg: string) => void
): Promise<string> {`
);

// Update extractTextViaGeminiVision logic for 4.15 (Capped at 60 pages)
content = content.replace(
  `  const numPages = pdf.numPages;
  const pageTexts: string[] = new Array(numPages).fill('');`,
  `  const numPages = pdf.numPages;
  const MAX_VISION_PAGES = 60;
  const pagesToProcess = Math.min(numPages, MAX_VISION_PAGES);
  if (numPages > MAX_VISION_PAGES) {
    onProgress?.(\`Large document: extracting the first \${MAX_VISION_PAGES} of \${numPages} pages via Vision.\`);
    console.warn(\`[Vision] Capping at \${MAX_VISION_PAGES} of \${numPages} pages to control cost and time.\`);
  }
  const pageTexts: string[] = new Array(pagesToProcess).fill('');`
);

content = content.replace(
  /for \(let i = 1; i <= numPages; i \+= batchSize\) {/g,
  `for (let i = 1; i <= pagesToProcess; i += batchSize) {`
);

content = content.replace(
  /const end = Math.min\(i \+ batchSize - 1, numPages\);/g,
  `const end = Math.min(i + batchSize - 1, pagesToProcess);`
);

// Update extractTextFromFile
const extractPdfOld = `  if (extension === 'pdf') {
    const extractPdf = async (): Promise<{ texts: string[], numPages: number }> => {
      if (!pdfjsLib) throw new Error("pdfjsLib not loaded");
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const pageTexts: string[] = new Array(pdf.numPages);`;

const extractPdfNew = `  if (extension === 'pdf') {
    if (!pdfjsLib) throw new Error("pdfjsLib not loaded");
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    
    try {
    const extractPdf = async (): Promise<{ texts: string[], numPages: number }> => {
      const pageTexts: string[] = new Array(pdf.numPages);`;

content = content.replace(extractPdfOld, extractPdfNew);

const extractPdfOcrOld = `    const extractPdfOcrForPages = async (pageIndicesToOcr: number[]): Promise<string[]> => {
      const buf = await file.arrayBuffer();
      if (!pdfjsLib) throw new Error("pdfjsLib not loaded");
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const pageTexts: string[] = new Array(pdf.numPages).fill('');`;

const extractPdfOcrNew = `    const extractPdfOcrForPages = async (pageIndicesToOcr: number[]): Promise<string[]> => {
      const pageTexts: string[] = new Array(pdf.numPages).fill('');`;

content = content.replace(extractPdfOcrOld, extractPdfOcrNew);

const fallbackOld = `      let { texts, numPages } = await extractPdf();
      let joinedText = texts.join('\\n');
      if (joinedText.trim().length < 200 || joinedText.trim().length < numPages * 50) {
        try {
          if (onProgress) onProgress('Extracting text from images using Gemini Vision… (starting)');
          const visionText = await extractTextViaGeminiVision(file, onProgress);`;

const fallbackNew = `      let { texts, numPages } = await extractPdf();
      let joinedText = texts.join('\\n');
      if (joinedText.trim().length < 200 || joinedText.trim().length < numPages * 50) {
        try {
          if (onProgress) onProgress('Extracting text from images using Gemini Vision… (starting)');
          const visionText = await extractTextViaGeminiVision(pdf, onProgress);`;

content = content.replace(fallbackOld, fallbackNew);

const returnOld = `      }
      return texts.join('\\n');
    } catch (err: any) {
      console.error("PDF basic extraction failed", err);
      throw err;
    }
  }`;

const returnNew = `      }
      return texts.join('\\n');
    } catch (err: any) {
      console.error("PDF basic extraction failed", err);
      throw err;
    } finally {
      await pdf.destroy();
    }
  }`;

content = content.replace(returnOld, returnNew);

fs.writeFileSync('src/lib/documentProcessor.ts', content);
console.log("Fixed PDF memory leak");
