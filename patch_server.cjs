const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// 1. Add import for latexToPhonetic
if (!code.includes("import { latexToPhonetic }")) {
    code = code.replace(
        "import { safeParseJSON } from './src/lib/utils.js';",
        "import { safeParseJSON } from './src/lib/utils.js';\nimport { latexToPhonetic } from './src/lib/mathTTS.js';"
    );
}

// 2. Replace the old normalizeTextWithLLM call with latexToPhonetic
const oldCode = `const cleanChunk = normalizeTextForCartesia(chunk.text);
          let spokenText = await normalizeTextWithLLM(cleanChunk);`;

const newCode = `const cleanChunk = normalizeTextForCartesia(chunk.text);
          // 1. Convert math symbols to phonetics so Kokoro reads them properly
          let spokenText = latexToPhonetic(cleanChunk);
          
          // 2. Optionally pass to LLM for final polish if needed (we'll stick to latexToPhonetic for precise timestamp matching)
          // spokenText = await normalizeTextWithLLM(spokenText); // Disabled to prevent word drift
          `;

code = code.replace(oldCode, newCode);

fs.writeFileSync('server.ts', code);
