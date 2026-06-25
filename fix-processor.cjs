const fs = require('fs');

const content = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

// Change 1: Update splitIntoChaptersEnhanced
let newContent = content.replace(
  `  const chapterRegex = /(?=\\n\\s*Unit\\s+[0-9IVX]+(?:\\s*[:\\-]?\\s*[A-Z][A-Za-z0-9\\s]+)?)/gi;
  
  const evalText = text.startsWith('\\n') ? text : '\\n' + text;
  let originalSplits = evalText.split(chapterRegex).filter(s => s.trim().length > 50);

  if (originalSplits.length <= 1) {
    originalSplits = [text];
  }`,
  `  let chapterRegex = /(?=\\n\\s*(?:Unit|CHAPTER|Chapter|Section|Part|Lesson|Module|Topic|PART|SECTION)\\s*[0-9IVX]+(?:\\s*[:\\-]\\s*[A-Za-z0-9\\s]+)?)/gi;
  
  const evalText = text.startsWith('\\n') ? text : '\\n' + text;
  let originalSplits = evalText.split(chapterRegex).filter(s => s.trim().length > 50);

  if (originalSplits.length <= 1) {
    chapterRegex = /(?=\\n\\s*(?:Unit|Chapter)\\s*[0-9IVX]+\\s*:)/gi;
    originalSplits = evalText.split(chapterRegex).filter(s => s.trim().length > 50);
  }

  if (originalSplits.length <= 1) {
    originalSplits = [text];
  }`
);

fs.writeFileSync('src/lib/documentProcessor.ts', newContent);
