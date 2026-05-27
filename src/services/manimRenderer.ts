import { GoogleGenAI } from '@google/genai';

const MANIM_API_URL = 'https://paulhemb-redora.hf.space/render';

// ------------------------------------------------------------------
// DeepSeek configuration
// ------------------------------------------------------------------
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY ?? '';   // set in your Vercel env
const DEEPSEEK_MODEL = 'deepseek-v4-flash';

// ------------------------------------------------------------------
// Gemini client (fallback, identical to your main app)
// ------------------------------------------------------------------
let _genai: any = null;
async function getGenAI() {
  if (!_genai) {
    _genai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        retryOptions: { attempts: 5 },   // built‑in retry for Gemini
      },
    });
  }
  return _genai;
}

// ------------------------------------------------------------------
// Robust retry wrapper for DeepSeek
// ------------------------------------------------------------------
async function callDeepSeekWithRetry(
  prompt: string,
  maxRetries = 3,
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_KEY}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 4096,
        }),
      });

      if (!res.ok) {
        // 429 and 5xx are retryable
        if (res.status === 429 || res.status >= 500) {
          const retryAfter = res.headers.get('Retry-After');
          const delay = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : Math.pow(2, attempt) * 1000;
          console.warn(`DeepSeek attempt ${attempt + 1} failed (${res.status}), retrying in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error(`DeepSeek API Error: ${await res.text()}`);
      }

      const data = await res.json();
      const content = data.choices[0].message.content;
      // Strip markdown code fences if present
      return content.replace(/^```python?\n?/, '').replace(/\n?```$/, '').trim();
    } catch (err: any) {
      if (attempt === maxRetries - 1) throw err;   // no more retries
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`DeepSeek attempt ${attempt + 1} failed, retrying in ${delay}ms`, err);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('DeepSeek retries exhausted');
}

// ------------------------------------------------------------------
// Primary: generate Manim code with DeepSeek, fallback to Gemini
// ------------------------------------------------------------------
async function generateManimCode(visualPrompt: string): Promise<string> {
  const prompt = `Generate Python code using the Manim Community library for this educational animation: ${visualPrompt}. Include proper imports and a Scene class with a construct method. Only return the code, no explanation.`;

  // 1. Try DeepSeek first (cheaper, fast, and robust retries)
  if (DEEPSEEK_KEY) {
    try {
      console.log('Generating Manim code with DeepSeek…');
      return await callDeepSeekWithRetry(prompt);
    } catch (err) {
      console.warn('DeepSeek failed, falling back to Gemini', err);
    }
  }

  // 2. Fallback to Gemini (with built‑in retries)
  console.log('Generating Manim code with Gemini…');
  const ai = await getGenAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { temperature: 0.2, maxOutputTokens: 4096 },
  });

  const code = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
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