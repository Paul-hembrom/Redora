const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

const oldLogic = `      if (joinedText.trim().length < 200 || joinedText.trim().length < numPages * 50) {
        try {
          if (onProgress) onProgress('Extracting text from images using Gemini Vision… (starting)');
          const visionText = await extractTextViaGeminiVision(file, onProgress);
          if (visionText && visionText.trim().length > 200) {
            return visionText;
          }
        } catch (visionErr) {
          console.error("Gemini Vision extraction failed, falling back to basic OCR", visionErr);
        }
      }

      const emptyPageIndices: number[] = [];
      for (let i = 0; i < texts.length; i++) {
        if (!texts[i] || texts[i].trim().length < 20) {
          emptyPageIndices.push(i);
        }
      }`;

const newLogic = `      const emptyPageIndices: number[] = [];
      for (let i = 0; i < texts.length; i++) {
        if (!texts[i] || texts[i].trim().length < 20) {
          emptyPageIndices.push(i);
        }
      }

      if (joinedText.trim().length < 200 || joinedText.trim().length < numPages * 50 || (emptyPageIndices.length / Math.max(1, numPages)) > 0.4) {
        try {
          if (onProgress) onProgress('Extracting text from images using Gemini Vision… (starting)');
          const visionText = await extractTextViaGeminiVision(file, onProgress);
          if (visionText && visionText.trim().length > 200) {
            return visionText;
          }
        } catch (visionErr) {
          console.error("Gemini Vision extraction failed, falling back to basic OCR", visionErr);
        }
      }`;

code = code.replace(oldLogic, newLogic);

fs.writeFileSync('src/lib/documentProcessor.ts', code);
