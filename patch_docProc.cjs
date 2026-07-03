const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

code = code.replace(
  "const aiExtracted = await extractViaAI(processedText, estimatedChapterCount);",
  "const fileExtension = file.name.split('.').pop()?.toLowerCase();\n        const aiExtracted = await extractViaAI(processedText, estimatedChapterCount, fileExtension);"
);

fs.writeFileSync('src/lib/documentProcessor.ts', code);
