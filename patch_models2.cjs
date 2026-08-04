const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf-8');

const visionFuncs = ['export async function generateContentFromImages', 'export async function generateContentFromImageUrl'];

let startIndex = 0;
for (const funcName of visionFuncs) {
    const idx = code.indexOf(funcName);
    if (idx !== -1) {
        const nextModelIdx = code.indexOf('model: MODEL_TEXT', idx);
        if (nextModelIdx !== -1) {
            code = code.substring(0, nextModelIdx) + 'model: MODEL_VISION' + code.substring(nextModelIdx + 'model: MODEL_TEXT'.length);
        }
    }
}
fs.writeFileSync('src/lib/gemini.ts', code);
