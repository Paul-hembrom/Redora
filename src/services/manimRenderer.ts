import { GoogleGenAI } from '@google/genai';

const MANIM_API_URL = 'https://paulhemb-redora.hf.space';

/**
 * Generate Manim Python code from a visual prompt.
 */
async function generateManimCode(visualPrompt: string): Promise<string> {
  const prompt = `Generate Python code using the Manim Community library for this educational animation: ${visualPrompt}. Include proper imports and a Scene class with a construct method. Only return the code, no explanation.`;
  
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });
  
  const code = response.text || '';
  // Strip markdown fences if the AI wraps them
  return code.replace(/^```python?\n?/, '').replace(/\n?```$/, '').trim();
}

/**
 * Render a scene via the Hugging Face Manim Space.
 * Returns the public video URL.
 */
export async function renderManimScene(
  visualPrompt: string,
  quality: 'low' | 'medium' | 'high' = 'low'
): Promise<string> {
  // 1. Generate Manim code
  const manimCode = await generateManimCode(visualPrompt);

  // 2. Send to the HF Space
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
