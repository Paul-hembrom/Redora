const fs = require('fs');
let content = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

const target1 = `  if (extension === 'pdf') {
    const extractPdf = async (): Promise<{ texts: string[], numPages: number }> => {
      if (!pdfjsLib) throw new Error("pdfjsLib not loaded");
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const pageTexts: string[] = new Array(pdf.numPages);`;

const newTarget1 = `  if (extension === 'pdf') {
    if (!pdfjsLib) throw new Error("pdfjsLib not loaded");
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    try {
    const extractPdf = async (): Promise<{ texts: string[], numPages: number }> => {
      const pageTexts: string[] = new Array(pdf.numPages);`;

content = content.replace(target1, newTarget1);
fs.writeFileSync('src/lib/documentProcessor.ts', content);
console.log("Fixed PDF var scope");
