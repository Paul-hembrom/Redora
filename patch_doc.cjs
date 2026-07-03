const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

// Add import
code = code.replace(/extractTextFromImage,/, "extractTextFromImage,\n  extractTextViaDeepSeekVision,");

// Update extraction logic
const newLogic = `
    try {
      let { texts, numPages } = await extractPdf();
      let joinedText = texts.join('\\n');

      if (joinedText.trim().length < 200 || joinedText.trim().length < numPages * 50) {
        try {
          if (onProgress) onProgress('Extracting text from images using DeepSeek Vision… (starting)');
          const visionText = await extractTextViaDeepSeekVision(file, onProgress);
          if (visionText && visionText.trim().length > 200) {
            return visionText;
          }
        } catch (visionErr) {
          console.error("DeepSeek Vision extraction failed, falling back to basic OCR", visionErr);
        }
      }

      const emptyPageIndices: number[] = [];`;

code = code.replace(/    try \{\n      let \{ texts, numPages \} = await extractPdf\(\);\n\s*const emptyPageIndices: number\[\] = \[\];/, newLogic);

fs.writeFileSync('src/lib/documentProcessor.ts', code);
