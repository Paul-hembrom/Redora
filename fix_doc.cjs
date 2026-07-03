const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

code = code.replace(/import \* as pdfjsLib from 'pdfjs-dist';\n/, '');

code = code.replace(/if \(typeof window !== 'undefined'\) \{\n  pdfjsLib\.GlobalWorkerOptions\.workerSrc = `\/\/unpkg\.com\/pdfjs-dist@\$\{pdfjsLib\.version\}\/build\/pdf\.worker\.min\.mjs`;\n\}/, `if (typeof window !== 'undefined') {
  import('pdfjs-dist').then(pdfjsLib => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = \`//unpkg.com/pdfjs-dist@\${pdfjsLib.version}/build/pdf.worker.min.mjs\`;
  }).catch(err => console.error("Failed to load pdfjs-dist", err));
}`);

code = code.replace(/const pdf = await pdfjsLib\.getDocument/g, "const pdfjsLib = await import('pdfjs-dist');\n      const pdf = await pdfjsLib.getDocument");

fs.writeFileSync('src/lib/documentProcessor.ts', code);
