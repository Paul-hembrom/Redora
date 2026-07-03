const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

const target = `let pdfjsLib: any = null;
if (typeof window !== 'undefined') {
  import('pdfjs-dist').then(lib => {
    pdfjsLib = lib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = \`//unpkg.com/pdfjs-dist@\${pdfjsLib.version}/build/pdf.worker.min.mjs\`;
  }).catch(console.error);
}`;

const replacement = `let pdfjsLib: any = null;
if (typeof window !== 'undefined') {
  pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = \`//unpkg.com/pdfjs-dist@\${pdfjsLib.version}/build/pdf.worker.min.mjs\`;
}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/lib/documentProcessor.ts', code);
