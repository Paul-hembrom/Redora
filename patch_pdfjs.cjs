const fs = require('fs');
let content = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

content = content.replace(
  "pdfjsLib = await import('pdfjs-dist');\n  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;",
  "import('pdfjs-dist').then(lib => {\n    pdfjsLib = lib;\n    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;\n  });"
);

fs.writeFileSync('src/lib/documentProcessor.ts', content);
