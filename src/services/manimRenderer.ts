import { callLLM } from '../lib/gemini.js';

const MANIM_API_URL = 'https://paulhemb-redora.hf.space/render';

async function generateManimCode(visualPrompt: string): Promise<string> {
  const prompt = `Generate Python code using the Manim Community library for this educational animation: ${visualPrompt}. Include proper imports and a Scene class with a construct method. Only return the code, no explanation.`;
  
  console.log('[Manim] Generating code for prompt:', visualPrompt.substring(0, 100));
  
  let code = '';
  try {
    code = await callLLM(prompt, undefined, 'text');
  } catch (error: any) {
    console.error('[Manim] DeepSeek generation failed:', error);
    throw error;
  }
  
  code = code.replace(/^```python?\n?/, '').replace(/\n?```$/, '').replace(/^```\n?/, '').trim();
  console.log('[Manim] Generated code length:', code.length);
  return code;
}

// ------------------------------------------------------------------
// Public: render a Manim scene via Hugging Face Space
// ------------------------------------------------------------------
export async function renderManimScene(
  visualPrompt: string,
  quality: 'low' | 'medium' | 'high' = 'low',
): Promise<string> {
  const manimCode = await generateManimCode(visualPrompt);

  console.log('[Manim] Calling HF Space:', MANIM_API_URL);
  const response = await fetch(MANIM_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      script_code: manimCode,
      scene_name: 'Scene',
      quality: quality,
    }),
  });

  console.log('[Manim] HF Space response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Manim] HF Space error response:', errorText);
    throw new Error(`Manim rendering failed: ${errorText}`);
  }

  const data = await response.json();
  if (!data.success || !data.video_url) {
    console.error('[Manim] HF Space success false or missing video_url:', data);
    throw new Error('Manim rendering returned no video URL');
  }

  return data.video_url;
}
