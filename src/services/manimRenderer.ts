import { callGeminiFlashLite } from '../lib/gemini.js';

const MANIM_API_URL = 'https://paulhemb-redora.hf.space/render';

async function generateManimCode(visualPrompt: string): Promise<string> {
  const prompt = `Generate Python code using the Manim Community library for this educational animation: ${visualPrompt}. Include proper imports and a Scene class with a construct method. Only return the code, no explanation.`;
  const code = await callGeminiFlashLite(prompt);
  return code.replace(/^```python?\n?/, '').replace(/\n?```$/, '').trim();
}

// ------------------------------------------------------------------
// Public: render a Manim scene via Hugging Face Space
// ------------------------------------------------------------------
export async function renderManimScene(
  visualPrompt: string,
  quality: 'low' | 'medium' | 'high' = 'low',
): Promise<string> {
  const manimCode = await generateManimCode(visualPrompt);

  const response = await fetch(MANIM_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      script_code: manimCode,
      scene_name: 'Scene',
      quality: quality,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(`Manim rendering failed: ${error.detail}`);
  }

  const data = await response.json();
  if (!data.success || !data.video_url) {
    throw new Error('Manim rendering returned no video URL');
  }
  return data.video_url;
}