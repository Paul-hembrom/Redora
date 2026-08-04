const fs = require('fs');
let content = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

const regex = /if\s*\(extension === 'pdf'\)\s*\{\s*const extractPdf = async \(\): Promise<\{ texts: string\[\], numPages: number \}> => \{\s*if \(!pdfjsLib\) throw new Error\("pdfjsLib not loaded"\);\s*const buf = await file\.arrayBuffer\(\);\s*const pdf = await pdfjsLib\.getDocument\(\{ data: buf \}\)\.promise;\s*const pageTexts: string\[\] = new Array\(pdf\.numPages\);/;

const replacement = `if (extension === 'pdf') {
    if (!pdfjsLib) throw new Error("pdfjsLib not loaded");
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    try {
    const extractPdf = async (): Promise<{ texts: string[], numPages: number }> => {
      const pageTexts: string[] = new Array(pdf.numPages);`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/lib/documentProcessor.ts', content);
console.log("Fixed with regex");
