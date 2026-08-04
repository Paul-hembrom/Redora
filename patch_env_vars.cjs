const fs = require('fs');
let memCode = fs.readFileSync('server/studentMemory.ts', 'utf-8');

const memTarget = `const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;`;
const memReplace = `const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY;`;
memCode = memCode.replace(memTarget, memReplace);
fs.writeFileSync('server/studentMemory.ts', memCode);

let geminiCode = fs.readFileSync('src/lib/gemini.ts', 'utf-8');
const gemTarget1 = `const DEEPSEEK_KEY = getEnvSafe('DEEPSEEK_API_KEY', () => import.meta.env.VITE_DEEPSEEK_API_KEY);`;
const gemReplace1 = `const DEEPSEEK_KEY = getEnvSafe('DEEPSEEK_API_KEY', () => import.meta.env?.VITE_DEEPSEEK_API_KEY)
                  || getEnvSafe('VITE_DEEPSEEK_API_KEY', () => import.meta.env?.VITE_DEEPSEEK_API_KEY);`;
geminiCode = geminiCode.replace(gemTarget1, gemReplace1);

const gemTarget2 = `const GEMINI_KEY = getEnvSafe('GEMINI_API_KEY', () => import.meta.env.VITE_GEMINI_API_KEY);`;
const gemReplace2 = `const GEMINI_KEY = getEnvSafe('GEMINI_API_KEY', () => import.meta.env?.VITE_GEMINI_API_KEY)
                || getEnvSafe('VITE_GEMINI_API_KEY', () => import.meta.env?.VITE_GEMINI_API_KEY);`;
geminiCode = geminiCode.replace(gemTarget2, gemReplace2);
fs.writeFileSync('src/lib/gemini.ts', geminiCode);
