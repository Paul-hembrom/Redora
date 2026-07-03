const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

// Update callDeepSeek timeout and model
code = code.replace(/const timeoutId = setTimeout\(\(\) => controller\.abort\(\), 1200000\); \/\/ 1200 seconds timeout/,
`const timeoutId = setTimeout(() => controller.abort(), imageUrl ? 120000 : 60000); // 120s for vision, 60s for text`);

code = code.replace(/model: 'deepseek-v4-flash',/, `model: 'deepseek-chat',`);

// Update extractTextViaDeepSeekVision
const oldExtractFn = `export async function extractTextViaDeepSeekVision(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdfjsLib = await import('pdfjs-dist');
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const numPages = pdf.numPages;
  const pageTexts: string[] = new Array(numPages).fill('');
  
  const batchSize = 5;
  for (let i = 1; i <= numPages; i += batchSize) {
    const end = Math.min(i + batchSize - 1, numPages);
    if (onProgress) {
      onProgress(\`Extracting text from images using DeepSeek Vision… (page \${i} of \${numPages})\`);
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
            
            const prompt = "Extract all text and mathematical expressions from this textbook page.\\nPreserve equations in LaTeX format. Preserve the reading order.\\nDo NOT summarize or omit any content. Return only the extracted text.";
            
            try {
              const text = await withRetry(() => callLLM(prompt, undefined, 'text', 16384, 0, dataUrl), 3, 5000);
              pageTexts[pageIndex] = text;
            } catch (err) {
              console.error(\`DeepSeek Vision failed on page \${j}:\`, err);
            }
          }
          page.cleanup();
        })
      );
    }
    await Promise.all(batchPromises);
  }
  return pageTexts.join('\\n\\n');
}`;

const newExtractFn = `export async function extractTextViaDeepSeekVision(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdfjsLib = await import('pdfjs-dist');
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const numPages = pdf.numPages;
  const pageTexts: string[] = new Array(numPages).fill('');
  
  let totalExtracted = 0;

  const batchSize = 5;
  for (let i = 1; i <= numPages; i += batchSize) {
    const end = Math.min(i + batchSize - 1, numPages);
    if (onProgress) {
      onProgress(\`Extracting text from images using DeepSeek Vision… (page \${i} of \${numPages})\`);
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
            
            const prompt = "Extract all text and mathematical expressions from this textbook page.\\nPreserve equations in LaTeX format. Preserve the reading order.\\nDo NOT summarize or omit any content. Return only the extracted text.";
            
            try {
              const text = await withRetry(() => callLLM(prompt, undefined, 'text', 16384, 0, dataUrl), 3, 5000);
              pageTexts[pageIndex] = text || '';
              const charCount = text ? text.length : 0;
              totalExtracted += charCount;
              console.log(\`Page \${j}: extracted \${charCount} characters\`);
            } catch (err: any) {
              console.error(\`Page \${j}: FAILED - \${err.message || String(err)}\`);
              pageTexts[pageIndex] = ''; // empty placeholder
            }
          }
          page.cleanup();
        })
      );
    }
    await Promise.all(batchPromises);
  }
  
  console.log(\`Total pages processed: \${numPages}, total characters extracted: \${totalExtracted}\`);
  const finalText = pageTexts.join('\\n\\n');
  if (finalText.trim().length === 0) {
    throw new Error('DeepSeek Vision returned no text — falling back to OCR');
  }
  return finalText;
}`;

code = code.replace(oldExtractFn, newExtractFn);

fs.writeFileSync('src/lib/gemini.ts', code);
