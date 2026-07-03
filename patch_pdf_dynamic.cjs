const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

// Remove the top-level pdfjs initialization
const topLevelRegex = /\/\/ ---------------------------------------------------------------------------\n\/\/ PDF\.js worker setup\n\/\/ ---------------------------------------------------------------------------\nif \(typeof window !== 'undefined'\) \{[\s\S]*?\n\}/g;
code = code.replace(topLevelRegex, '');

// Update extractPdf to configure it locally if not already done
const oldExtractPdf = `const extractPdf = async (): Promise<{ texts: string[], numPages: number }> => {\n      const buf = await file.arrayBuffer();\n      const pdfjsLib = await import('pdfjs-dist');`;
const newExtractPdf = `const extractPdf = async (): Promise<{ texts: string[], numPages: number }> => {\n      const buf = await file.arrayBuffer();\n      const pdfjsLib = await import('pdfjs-dist');\n      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {\n        pdfjsLib.GlobalWorkerOptions.workerSrc = \`//unpkg.com/pdfjs-dist@\${pdfjsLib.version}/build/pdf.worker.min.mjs\`;\n      }`;
code = code.replace(oldExtractPdf, newExtractPdf);

fs.writeFileSync('src/lib/documentProcessor.ts', code);
