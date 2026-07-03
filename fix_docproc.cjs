const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

const importRegex = /from '\.\/gemini';\n/g;
code = code.replace(importRegex, "from './gemini';\n\nlet pdfjsLib: any = null;\nif (typeof window !== 'undefined') {\n  import('pdfjs-dist').then(lib => {\n    pdfjsLib = lib;\n    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;\n  }).catch(console.error);\n}\n");

const extractPdfCode = `const extractPdf = async (): Promise<{ texts: string[], numPages: number }> => {\n      const buf = await file.arrayBuffer();\n      const pdfjsLib = await import('pdfjs-dist');\n      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {\n        pdfjsLib.GlobalWorkerOptions.workerSrc = \`//unpkg.com/pdfjs-dist@\${pdfjsLib.version}/build/pdf.worker.min.mjs\`;\n      }`;
const newExtractPdfCode = `const extractPdf = async (): Promise<{ texts: string[], numPages: number }> => {\n      if (!pdfjsLib) throw new Error("pdfjsLib not loaded");\n      const buf = await file.arrayBuffer();`;
code = code.replace(extractPdfCode, newExtractPdfCode);

const dynamicImport2 = `const pdfjsLib = await import('pdfjs-dist');`;
code = code.replace(dynamicImport2, `if (!pdfjsLib) throw new Error("pdfjsLib not loaded");`);

fs.writeFileSync('src/lib/documentProcessor.ts', code);
