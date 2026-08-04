const fs = require('fs');
let content = fs.readFileSync('src/services/manimRenderer.ts', 'utf-8');

const importStr = `import { callLLM } from '../lib/gemini.js';`;
const newImportStr = `import { callLLM } from '../lib/gemini.js';
import crypto from 'crypto';
import sql from '../../server/db.js';`;

content = content.replace(importStr, newImportStr);

const funcStart = `export async function renderManimScene(
  visualPrompt: string,
  quality: 'low' | 'medium' | 'high' = 'low',
): Promise<string> {`;

const newFuncStart = `export async function renderManimScene(
  visualPrompt: string,
  quality: 'low' | 'medium' | 'high' = 'low',
): Promise<string> {
  let promptHash;
  try {
    promptHash = crypto.createHash('sha256')
      .update(\`\${quality}|\${visualPrompt}\`)
      .digest('hex');

    const cached = await sql\`SELECT video_url FROM manim_cache WHERE prompt_hash = \${promptHash}\`;
    if (cached.length) {
      console.log('[Manim] Cache hit — skipping render.');
      return cached[0].video_url;
    }
  } catch(e) {
    console.error("Cache check failed:", e);
  }`;

content = content.replace(funcStart, newFuncStart);

const funcEnd = `  if (!data.success || !data.video_url) {
    console.error('[Manim] HF Space success false or missing video_url:', data);
    throw new Error('Manim rendering returned no video URL');
  }

  return data.video_url;
}`;

const newFuncEnd = `  if (!data.success || !data.video_url) {
    console.error('[Manim] HF Space success false or missing video_url:', data);
    throw new Error('Manim rendering returned no video URL');
  }

  if (promptHash) {
    try {
      await sql\`
        INSERT INTO manim_cache (prompt_hash, visual_prompt, video_url)
        VALUES (\${promptHash}, \${visualPrompt}, \${data.video_url})
        ON CONFLICT (prompt_hash) DO NOTHING
      \`;
    } catch(e) {
       console.error("Failed to save to manim_cache:", e);
    }
  }

  return data.video_url;
}`;

content = content.replace(funcEnd, newFuncEnd);
fs.writeFileSync('src/services/manimRenderer.ts', content);
console.log("Fixed manim cache");
