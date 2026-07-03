const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const oldFnStart = code.indexOf('export async function extractTextViaDeepSeekVision');
const oldFnEnd = code.indexOf('}', code.indexOf('return finalText;', oldFnStart)) + 1;
const oldFn = code.substring(oldFnStart, oldFnEnd);

const newFn = `export async function extractTextViaDeepSeekVision(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdfjsLib = await import('pdfjs-dist');
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const numPages = pdf.numPages;
  const pageTexts: string[] = new Array(numPages).fill('');
  
  let totalExtracted = 0;
  let failedPages = 0;
  
  const startTime = Date.now();

  const VISION_CONCURRENCY = 10;
  for (let i = 1; i <= numPages; i += VISION_CONCURRENCY) {
    const end = Math.min(i + VISION_CONCURRENCY - 1, numPages);
    if (onProgress) {
      let progressMsg = \`Extracting text from images using DeepSeek Vision… (page \${i} of \${numPages})\`;
      if (i > 1) {
        const pagesProcessed = i - 1;
        const elapsed = Date.now() - startTime;
        const avgTimePerPage = elapsed / pagesProcessed;
        const remaining = avgTimePerPage * (numPages - pagesProcessed);
        progressMsg += \` (~\${Math.ceil(remaining / 60000)} min remaining)\`;
      }
      onProgress(progressMsg);
    }
    const batchPromises: Promise<void>[] = [];
    for (let j = i; j <= end; j++) {
      const pageIndex = j - 1;
      batchPromises.push(
        pdf.getPage(j).then(async page => {
          const viewport = page.getViewport({ scale: 1.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport, canvas: canvas }).promise;
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            
            const prompt = "Extract all text and mathematical expressions from this textbook page.\\nPreserve equations in LaTeX format. Preserve the reading order.\\nDo NOT summarize or omit any content. Return only the extracted text.";
            
            try {
              const text = await callLLM(prompt, undefined, 'text', 16384, 0, dataUrl);
              pageTexts[pageIndex] = text || '';
              const charCount = text ? text.length : 0;
              totalExtracted += charCount;
              console.log(\`Page \${j}: extracted \${charCount} characters\`);
            } catch (err: any) {
              console.error(\`Page \${j}: FAILED - \${err.message || String(err)}\`);
              pageTexts[pageIndex] = ''; // empty placeholder
              failedPages++;
            }
          }
          page.cleanup();
        })
      );
    }
    await Promise.all(batchPromises);
  }
  
  const totalTime = Date.now() - startTime;
  console.log(\`Total pages processed: \${numPages}, total characters extracted: \${totalExtracted}\`);
  console.log(\`Total time: \${Math.round(totalTime / 1000)}s, avg per page: \${Math.round(totalTime / numPages / 1000)}s\`);
  
  if (failedPages / numPages > 0.2) {
    console.warn(\`WARNING: \${failedPages} of \${numPages} pages failed during vision extraction. The book may need manual review.\`);
  }

  const finalText = pageTexts.join('\\n\\n');
  if (finalText.trim().length === 0) {
    throw new Error('DeepSeek Vision returned no text — falling back to OCR');
  }
  return finalText;
}`;

code = code.replace(oldFn, newFn);
fs.writeFileSync('src/lib/gemini.ts', code);
