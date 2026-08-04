const fs = require('fs');

// 1. Fix server.ts verifyAndIncrementUsage signature
let server = fs.readFileSync('server.ts', 'utf-8');
server = server.replace('async function verifyAndIncrementUsage(userId: string, type: string, orgId?: string) {', 'async function verifyAndIncrementUsage(userId: string, type: string, orgId?: string, verifyOnly?: boolean) {');

// We also have calls with 4 args but some are missing verifyOnly?
// TS says:
// server.ts(989,68): error TS2554: Expected 2-3 arguments, but got 4.
// server.ts(4053,86): error TS2554: Expected 2-3 arguments, but got 4.
// Both of these will be fixed when we update the signature.
fs.writeFileSync('server.ts', server);

// 2. Fix server/videoPipeline.ts `narration` variable
let vp = fs.readFileSync('server/videoPipeline.ts', 'utf-8');
vp = vp.replace('VALUES (${sceneId}, ${sbId}, ${org_id}, ${i}, ${narration}, ${visualPrompt}, ${duration})', 'VALUES (${sceneId}, ${sbId}, ${org_id}, ${i}, ${sc.narration}, ${visualPrompt}, ${duration})');
fs.writeFileSync('server/videoPipeline.ts', vp);

// 3. Fix src/lib/gemini.ts MODEL_TEXT not found
let gem = fs.readFileSync('src/lib/gemini.ts', 'utf-8');
gem = gem.replace(`export function getEnvSafe`, `export const MODEL_TEXT = getEnvSafe('MODEL_TEXT', () => import.meta.env?.VITE_MODEL_TEXT) || 'deepseek-v4-flash';
export const MODEL_VISION = getEnvSafe('MODEL_VISION', () => import.meta.env?.VITE_MODEL_VISION) || 'gemini-2.5-flash';
export const MODEL_MEMORY = getEnvSafe('MODEL_MEMORY', () => import.meta.env?.VITE_MODEL_MEMORY) || 'gemini-2.5-flash';

export function getEnvSafe`);
fs.writeFileSync('src/lib/gemini.ts', gem);

// 4. Fix src/lib/documentProcessor.ts chunkIndex type error
let dp = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');
dp = dp.replace(`const extractionResults = await Promise.all(extractionJobs);`, `const extractionResults: any[] = await Promise.all(extractionJobs);`);
fs.writeFileSync('src/lib/documentProcessor.ts', dp);

