const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

if (!code.includes("import * as pdfjsLib")) {
  code = "import * as pdfjsLib from 'pdfjs-dist';\n" + code;
}

const newFunction = `

export async function extractTextViaDeepSeekVision(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  const buf = await file.arrayBuffer();
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
}
`;

if (!code.includes("extractTextViaDeepSeekVision")) {
  code += newFunction;
  fs.writeFileSync('src/lib/gemini.ts', code);
}
