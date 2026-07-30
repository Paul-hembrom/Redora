import { callLLM } from '../lib/gemini.js';

const MANIM_API_URL = 'https://paulhemb-redora.hf.space/render';

// The name we *ask* the model to use. This is just a hint for the prompt —
// the actual name sent to the render backend is always parsed back out of
// the generated code (see extractSceneClassName), so a model deviating from
// this doesn't break anything.
const REQUESTED_SCENE_CLASS_NAME = 'GeneratedScene';

// Comfortably longer than the backend's MANIM_TIMEOUT (default 300s), to
// leave room for HF Space cold-start + network latency on top of render time.
const RENDER_TIMEOUT_MS = 360_000;

// Mirrors main.py's FORBIDDEN_IMPORTS on the backend, so we steer the model
// away from imports it would get rejected for anyway.
const FORBIDDEN_IMPORTS = [
  'os', 'subprocess', 'sys', 'shutil', 'socket', 'requests', 'http',
  'urllib', 'pathlib', 'glob', 'pickle', 'eval', 'exec', 'compile',
  '__import__', 'open',
];

interface GeneratedScene {
  code: string;
  sceneName: string;
}

// ------------------------------------------------------------------
// Pull just the code out of an LLM response.
//
// Uses a non-anchored search for a fenced code block, so it still works
// even if the model adds a stray line of commentary before or after the
// fence (the previous ^...$-anchored replace() chain silently failed in
// that case and left markdown fences/prose in what got written to
// scene.py, which is a guaranteed syntax error on the backend).
// Falls back to treating the whole response as code if no fence is found.
// ------------------------------------------------------------------
function extractPythonCode(raw: string): string {
  const fenced = raw.match(/```(?:python)?\s*\n?([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}

// ------------------------------------------------------------------
// Pull the actual Scene subclass name out of the generated code.
//
// This is the core fix: we never assume the class is literally named
// "Scene" (it almost never is — the model names it after the topic). We
// find whatever it actually called it and use that when calling the
// render backend, instead of hardcoding a name that usually doesn't exist
// in the file.
//
// Matches "class Foo(Scene):" as well as variants like
// "class Foo(ThreeDScene):" or "class Foo(MovingCameraScene):".
// ------------------------------------------------------------------
function extractSceneClassName(code: string): string | null {
  const match = code.match(/class\s+(\w+)\s*\([^)]*Scene[^)]*\)\s*:/);
  return match ? match[1] : null;
}

async function generateManimCode(visualPrompt: string): Promise<GeneratedScene> {
  const prompt = `Generate Python code using the Manim Community library (import via "from manim import *") for this educational animation: ${visualPrompt}.

Requirements:
- Define exactly one Scene subclass named "${REQUESTED_SCENE_CLASS_NAME}", e.g. "class ${REQUESTED_SCENE_CLASS_NAME}(Scene):", with a construct method containing the animation.
- Do not import or use any of: ${FORBIDDEN_IMPORTS.join(', ')}. Use only Manim built-ins (and numpy if needed).
- Return ONLY the raw Python code — no markdown code fences, no explanation, no commentary before or after.`;

  console.log('[Manim] Generating code for prompt:', visualPrompt.substring(0, 100));

  let raw = '';
  try {
    raw = await callLLM(prompt, undefined, 'text');
  } catch (error: any) {
    console.error('[Manim] Code generation failed:', error);
    throw error;
  }

  const code = extractPythonCode(raw);

  const sceneName = extractSceneClassName(code);
  if (!sceneName) {
    console.error('[Manim] No Scene subclass found in generated code:\n', code);
    throw new Error('Generated Manim code has no recognizable Scene subclass');
  }

  console.log('[Manim] Generated code length:', code.length, '| scene class:', sceneName);
  return { code, sceneName };
}

// ------------------------------------------------------------------
// Public: render a Manim scene via Hugging Face Space
// ------------------------------------------------------------------
export async function renderManimScene(
  visualPrompt: string,
  quality: 'low' | 'medium' | 'high' = 'low',
): Promise<string> {
  const { code: manimCode, sceneName } = await generateManimCode(visualPrompt);

  console.log('[Manim] Calling HF Space:', MANIM_API_URL, '| scene:', sceneName, '| quality:', quality);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(MANIM_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script_code: manimCode,
        scene_name: sceneName,
        quality,
      }),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(
        `Manim rendering timed out after ${RENDER_TIMEOUT_MS / 1000}s ` +
        `(the HF Space may be cold-starting or overloaded)`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  console.log('[Manim] HF Space response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Manim] HF Space error response:', errorText);
    throw new Error(`Manim rendering failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.success || !data.video_url) {
    console.error('[Manim] HF Space success false or missing video_url:', data);
    throw new Error('Manim rendering returned no video URL');
  }

  return data.video_url;
}