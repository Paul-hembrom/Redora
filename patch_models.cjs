const fs = require('fs');

// Patch src/lib/gemini.ts
let gemCode = fs.readFileSync('src/lib/gemini.ts', 'utf-8');

const targetModelConst = `const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });`;
const replaceModelConst = `const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
export const MODEL_TEXT = getEnvSafe('MODEL_TEXT', () => import.meta.env?.VITE_MODEL_TEXT) || 'deepseek-v4-flash';
export const MODEL_VISION = getEnvSafe('MODEL_VISION', () => import.meta.env?.VITE_MODEL_VISION) || 'gemini-2.5-flash';
export const MODEL_MEMORY = getEnvSafe('MODEL_MEMORY', () => import.meta.env?.VITE_MODEL_MEMORY) || 'gemini-2.5-flash';
`;
gemCode = gemCode.replace(targetModelConst, replaceModelConst);

gemCode = gemCode.replace(/model: 'gemini-2.5-flash',/g, `model: MODEL_TEXT,`); // We will change this in a sec
fs.writeFileSync('src/lib/gemini.ts', gemCode);

// Patch server/storyboardEngine.ts
let sbCode = fs.readFileSync('server/storyboardEngine.ts', 'utf-8');
sbCode = sbCode.replace(/model: 'gemini-2.5-flash',/g, `model: process.env.MODEL_TEXT || 'deepseek-v4-flash',`);
fs.writeFileSync('server/storyboardEngine.ts', sbCode);

// Patch src/lib/documentProcessor.ts
let dpCode = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');
dpCode = dpCode.replace(/model: 'gemini-2.5-flash',/g, `model: import.meta.env.VITE_MODEL_TEXT || 'deepseek-v4-flash',`);
fs.writeFileSync('src/lib/documentProcessor.ts', dpCode);

