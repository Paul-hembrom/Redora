const fs = require('fs');

const geminiCode = `export async function extractTextViaGeminiVision(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  const buf = await file.arrayBuffer();
  if (!pdfjsLib) throw new Error("pdfjsLib not loaded");
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const numPages = pdf.numPages;
  const pageTexts: string[] = new Array(numPages).fill('');
  const batchSize = 10;
  const ai = await getGenAI();

  let totalExtracted = 0;
  let failedPages = 0;
  const startTime = Date.now();

  for (let i = 1; i <= numPages; i += batchSize) {
    const end = Math.min(i + batchSize - 1, numPages);
    if (onProgress) {
      let progressMsg = \`Extracting text from images using Gemini Vision… (page \${i} of \${numPages})\`;
      if (i > 1) {
        const pagesProcessed = i - 1;
        const elapsed = Date.now() - startTime;
        const avgTimePerPage = elapsed / pagesProcessed;
        const remaining = avgTimePerPage * (numPages - pagesProcessed);
        progressMsg += \` (~\${Math.ceil(remaining / 60000)} min remaining)\`;
      }
      onProgress(progressMsg);
    }

    const batchPromises = [];
    for (let j = i; j <= end; j++) {
      batchPromises.push((async () => {
        const pageIndex = j - 1;
        try {
          const page = await pdf.getPage(j);
          const viewport = page.getViewport({ scale: 1.0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise;

            const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: {
                role: 'user',
                parts: [
                  { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                  { text: 'Extract all text and mathematical expressions from this textbook page. Preserve equations in LaTeX format. Preserve the reading order. Do NOT summarize or omit any content. Return only the extracted text.' }
                ]
              },
              config: { temperature: 0, maxOutputTokens: 8192 }
            });

            const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            pageTexts[pageIndex] = text;
            totalExtracted += text.length;
            console.log(\`Page \${j}: extracted \${text.length} characters\`);
          }
          page.cleanup();
        } catch (err: any) {
          console.error(\`Page \${j}: FAILED - \${err.message || String(err)}\`);
          pageTexts[pageIndex] = '';
          failedPages++;
        }
      })());
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
    throw new Error('Gemini Vision returned no text — falling back to OCR');
  }

  return finalText;
}
`;

let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

const regex = /export async function extractTextViaDeepSeekVision\([\s\S]+$/;
code = code.replace(regex, geminiCode);

// Also update callers
code = code.replace(/extractTextViaDeepSeekVision/g, 'extractTextViaGeminiVision');
code = code.replace(/DeepSeek Vision/g, 'Gemini Vision');

fs.writeFileSync('src/lib/documentProcessor.ts', code);
