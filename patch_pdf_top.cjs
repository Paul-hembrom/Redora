const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

code = code.replace(
  "if (typeof window !== 'undefined') {\n  const pdfjsLib = await import('pdfjs-dist');\n  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;\n}",
  "if (typeof window !== 'undefined') {\n  import('pdfjs-dist').then(pdfjsLib => {\n    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;\n  }).catch(err => console.error(\"Failed to load pdfjs-dist\", err));\n}"
);

fs.writeFileSync('src/lib/documentProcessor.ts', code);
