const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const oldCode = `const pdfjsLib = await import('pdfjs-dist');
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;`;
const newCode = `const pdfjsLib = await import('pdfjs-dist');
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = \`//unpkg.com/pdfjs-dist@\${pdfjsLib.version}/build/pdf.worker.min.mjs\`;
  }
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;`;
code = code.replace(oldCode, newCode);

fs.writeFileSync('src/lib/gemini.ts', code);
