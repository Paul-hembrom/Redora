const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

const oldVisionCode = `  const pdfjsLib = await import('pdfjs-dist');
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = \`//unpkg.com/pdfjs-dist@\${pdfjsLib.version}/build/pdf.worker.min.mjs\`;
  }`;

const newVisionCode = `  if (!pdfjsLib) throw new Error("pdfjsLib not loaded");`;

code = code.replace(oldVisionCode, newVisionCode);

fs.writeFileSync('src/lib/documentProcessor.ts', code);
