const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Import it at the top
if (!code.includes('normalizeTextWithLLM')) {
    code = code.replace(
        "import { generateChapterMetadata, generateSearchQueries, callLLM } from './src/lib/gemini.js';",
        "import { generateChapterMetadata, generateSearchQueries, callLLM } from './src/lib/gemini.js';\nimport { normalizeTextWithLLM } from './src/lib/llmNormalizer.js';"
    );
}

// Remove the old normalizeTextForTTS function
code = code.replace(/async function normalizeTextForTTS[\s\S]*?return text;\n  \}\n\}/, '');

// Remove the old cache
code = code.replace("const ttsNormalizationCache = new Map<string, string>();\n", "");

// Update the cartesia handler
const oldLogic = `        let spokenText = normalizeTextForCartesia(chunk.text);
        if (/\\\\[a-zA-Z]+|\\\\{|\\\\}/.test(chunk.text)) {
            if (ttsNormalizationCache.has(chunk.text)) {
                spokenText = ttsNormalizationCache.get(chunk.text)!;
            } else {
                spokenText = await normalizeTextForTTS(spokenText);
                ttsNormalizationCache.set(chunk.text, spokenText);
            }
        }`;

const newLogic = `        let spokenText = normalizeTextForCartesia(chunk.text);
        if (/\\\\[a-zA-Z]+|\\\\{|\\\\}/.test(chunk.text)) {
            spokenText = await normalizeTextWithLLM(spokenText);
        }`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('server.ts', code);
console.log('patched');
