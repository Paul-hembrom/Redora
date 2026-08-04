const fs = require('fs');
let code = fs.readFileSync('src/services/manimRenderer.ts', 'utf-8');

const target = `    response = await fetch(MANIM_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({`;

const replace = `    response = await fetch(MANIM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': process.env.INTERNAL_API_KEY || ''
      },
      body: JSON.stringify({`;

code = code.replace(target, replace);

// P1-6 — Manim code generation truncates at 4096 tokens, with no retry
const targetP1_6 = `    const raw = await callLLM(prompt, undefined, 'text');
    
    // The model might wrap code in markdown blocks
    const code = extractPythonCode(raw);
    const sceneName = extractSceneClassName(code);
    
    if (!sceneName) {
      throw new Error('Generated Manim code has no recognizable Scene subclass');
    }
    
    console.log('[Manim] Extracted code length:', code.length, '| Scene class:', sceneName);
    return { code, sceneName };`;

const replaceP1_6 = `    let lastErr: any;
    for (let i = 0; i < 2; i++) {
      try {
        const raw = await callLLM(prompt, undefined, 'text', 8192, 0.2);
        
        const code = extractPythonCode(raw);
        const sceneName = extractSceneClassName(code);
        
        if (!sceneName) {
          throw new Error('Generated Manim code has no recognizable Scene subclass');
        }
        
        console.log('[Manim] Extracted code length:', code.length, '| Scene class:', sceneName);
        return { code, sceneName };
      } catch (e) {
        lastErr = e;
        console.warn(\`[Manim] generation attempt \${i + 1}/2 failed:\`, e);
      }
    }
    throw lastErr;`;

code = code.replace(targetP1_6, replaceP1_6);

fs.writeFileSync('src/services/manimRenderer.ts', code);
