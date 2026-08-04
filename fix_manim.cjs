const fs = require('fs');
let content = fs.readFileSync('src/services/manimRenderer.ts', 'utf-8');

content = content.replace(
  "const MANIM_API_URL = 'https://paulhemb-redora.hf.space/render';",
  "const MANIM_API_URL = `${process.env.HF_SPACE_URL || 'https://paulhemb-redora.hf.space'}/render`;"
);

const oldGen = /async function generateManimCode\([\s\S]*?return \{ code, sceneName \};\n\}/;

const newGen = `async function generateManimCode(visualPrompt: string, attempts = 2): Promise<GeneratedScene> {
  const prompt = \`Generate Python code using the Manim Community library (import via "from manim import *") for this educational animation: \${visualPrompt}.
Requirements:
- Define exactly one Scene subclass named "\${REQUESTED_SCENE_CLASS_NAME}", e.g. "class \${REQUESTED_SCENE_CLASS_NAME}(Scene):", with a construct method containing the animation.
- You may ONLY import from: manim, numpy, math, random, itertools, functools, operator, typing, dataclasses, collections, fractions.
- Do not call eval, exec, compile, open, getattr, setattr, or __import__, and do not access dunder attributes.
- Return ONLY the raw Python code — no markdown code fences, no explanation, no commentary before or after.\`;

  console.log('[Manim] Generating code for prompt:', visualPrompt.substring(0, 100));

  let lastErr: any;

  for (let i = 0; i < attempts; i++) {
    try {
      const raw = await callLLM(prompt, undefined, 'text', 8192, 0.2);
      const code = extractPythonCode(raw);
      const sceneName = extractSceneClassName(code);
      if (!sceneName) {
        throw new Error('Generated Manim code has no recognizable Scene subclass');
      }
      console.log('[Manim] code length:', code.length, '| scene class:', sceneName);
      return { code, sceneName };
    } catch (e) {
      lastErr = e;
      console.warn(\`[Manim] generation attempt \${i + 1}/\${attempts} failed:\`, e);
    }
  }
  throw lastErr;
}`;

content = content.replace(oldGen, newGen);
fs.writeFileSync('src/services/manimRenderer.ts', content);
console.log("Fixed manimRenderer");
