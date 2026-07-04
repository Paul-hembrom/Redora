const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

// remove the import I just added to prevent conflict
code = code.replace(/,\n  withRetry\n\} from '\.\/gemini';/, "\n} from './gemini';");

const oldCode = `            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: {
                role: 'user',
                parts: [
                  { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                  { text: 'Extract all text and mathematical expressions from this textbook page. Preserve equations in LaTeX format. Preserve the reading order. Do NOT summarize or omit any content. Return only the extracted text.' }
                ]
              },
              config: { temperature: 0, maxOutputTokens: 8192 }
            });`;

const newCode = `            const response = await withRetry(() => ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: {
                role: 'user',
                parts: [
                  { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                  { text: 'Extract all text and mathematical expressions from this textbook page. Preserve equations in LaTeX format. Preserve the reading order. Do NOT summarize or omit any content. Return only the extracted text.' }
                ]
              },
              config: { temperature: 0, maxOutputTokens: 8192 }
            }), 3, 5000);`;

code = code.replace(oldCode, newCode);

fs.writeFileSync('src/lib/documentProcessor.ts', code);
