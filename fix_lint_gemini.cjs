const fs = require('fs');

let gem = fs.readFileSync('src/lib/gemini.ts', 'utf-8');
gem = gem.replace(`function getEnvSafe(key: string, getViteEnv: () => string | undefined): string {`, `export const MODEL_TEXT = "gemini-2.5-flash";
export const MODEL_VISION = "gemini-2.5-flash";
export const MODEL_MEMORY = "gemini-2.5-flash";

function getEnvSafe(key: string, getViteEnv: () => string | undefined): string {`);
fs.writeFileSync('src/lib/gemini.ts', gem);
