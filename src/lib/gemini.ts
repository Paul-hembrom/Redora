import { ChatMessage, ReadingPersona } from '../types';
import { jsonrepair } from 'jsonrepair';

// ──────────────────────────────────────────────
// 1. Error & helpers (unchanged)
// ──────────────────────────────────────────────
export class ApiRateLimitError extends Error {
  public retryAfterMs: number;
  constructor(message: string, retryAfterMs: number) {
    super(`Rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1000)} seconds before trying again.`);
    this.name = 'ApiRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

function cleanErrorMessage(error: any): string {
  return error?.message || 'An unknown error occurred.';
}

// ──────────────────────────────────────────────
// 2. Env helpers – centralise API keys
// ──────────────────────────────────────────────
function getEnvSafe(key: string, getViteEnv: () => string | undefined): string {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  try {
    const val = getViteEnv();
    if (val) return val;
  } catch (e) {}
  return '';
}

const DEEPSEEK_KEY = getEnvSafe('VITE_DEEPSEEK_API_KEY', () => import.meta.env.VITE_DEEPSEEK_API_KEY as string);
const GEMINI_KEY   = getEnvSafe('VITE_GEMINI_API_KEY',   () => import.meta.env.VITE_GEMINI_API_KEY as string);
const EL_KEY       = getEnvSafe('VITE_ELEVENLABS_API_KEY', () => import.meta.env.VITE_ELEVENLABS_API_KEY as string);

function hasKey(key: string | undefined): key is string {
  return typeof key === 'string' && key.length > 0;
}

// ──────────────────────────────────────────────
// 3. DeepSeek V4‑Flash (OpenAI‑compatible) — WITH RETRY
// ──────────────────────────────────────────────
async function callDeepSeek(
  prompt: string,
  systemInstruction?: string,
  responseFormat?: 'json_object' | 'text',
  maxTokens?: number,
  maxRetries = 3,
): Promise<string> {
  const messages: any[] = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  messages.push({ role: 'user', content: prompt });

  const body: any = {
    model: 'deepseek-v4-flash',
    messages,
    temperature: 0.2,
    max_tokens: maxTokens ?? 4096,
  };
  if (responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 503 || res.status === 502 || res.status === 504) {
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`DeepSeek ${res.status} – retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new ApiRateLimitError(`DeepSeek server error ${res.status}`, 5000);
      }
      if (res.status === 429) throw new ApiRateLimitError('DeepSeek rate limit', 5000);
      const errText = await res.text();
      throw new Error(`DeepSeek API Error: ${errText}`);
    }

    const data = await res.json();
    let content = data.choices[0].message.content;
    const finishReason = data.choices[0].finish_reason;
    
    if (finishReason === 'length' && responseFormat === 'json_object') {
      if (attempt < maxRetries) {
        console.warn(`DeepSeek truncated JSON (finish_reason=length) – retrying (attempt ${attempt + 1}/${maxRetries})`);
        continue;
      }
      console.warn(`DeepSeek truncated JSON max retries reached. Let JSON repair handle it.`);
    }

    content = content.replace(/^```json\\n?/, '').replace(/\\n?```$/, '').trim();
    return content;
  }

  throw new Error('DeepSeek retries exhausted');
}

// ──────────────────────────────────────────────
// 4. Gemini (Flash‑Lite, TTS, Veo) via @google/genai
// ──────────────────────────────────────────────
let _genai: any = null;
async function getGenAI() {
  if (!_genai) {
    const { GoogleGenAI } = await import('@google/genai');
    _genai = new GoogleGenAI({
      apiKey: GEMINI_KEY,
      httpOptions: {
        retryOptions: {
          attempts: 5
        }
      }
    });
  }
  return _genai;
}

/** Gemini Flash‑Lite for chat / structured output */
export async function callGeminiFlashLite(
  prompt: string,
  systemInstruction?: string,
): Promise<string> {
  const ai = await getGenAI();
  const parts: any[] = [{ text: prompt }];
  const config: any = { temperature: 0.2, maxOutputTokens: 4096 };
  if (systemInstruction) config.systemInstruction = systemInstruction;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts }],
    config,
  });

  let text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  text = text.replace(/^```json\\n?/, '').replace(/\\n?```$/, '').trim();
  return text;
}

/** Gemini TTS – returns a base64 WAV data URL */
async function callGeminiTTS(
  text: string,
  voiceName: string = 'Kore',
): Promise<string> {
  const ai = await getGenAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-tts-preview',
    contents: [{ role: 'user', parts: [{ text }] }],
    config: {
      speechConfig: {
        prebuiltVoiceConfig: { voiceName },
      },
      responseModalities: ['AUDIO'],
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData) throw new Error('TTS generation returned no audio');
  const { data: rawData, mimeType } = part.inlineData;

  const wavBase64 = pcmToWavBase64(rawData, mimeType);
  return `data:audio/wav;base64,${wavBase64}`;
}

/** Veo 3.1 Lite video generation (async polling) */
async function callVeo31Lite(
  prompt: string,
  aspectRatio: '16:9' | '9:16' = '16:9',
): Promise<string> {
  const ai = await getGenAI();
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-lite-generate-preview',
    prompt,
    config: { aspectRatio },
  });

  while (!operation.done) {
    await new Promise(r => setTimeout(r, 10_000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const video = operation.response?.generatedVideos?.[0]?.video;
  if (!video) throw new Error('Veo generation returned no video');
  return video.uri;
}

// ──────────────────────────────────────────────
// 5. ElevenLabs Scribe STT
// ──────────────────────────────────────────────
async function callElevenLabsSTT(audioBlob: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', audioBlob, 'recording.webm');
  form.append('model_id', 'scribe_v2');

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': EL_KEY },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs STT Error: ${errText}`);
  }

  const data = await res.json();
  return data.text ?? '';
}

// ──────────────────────────────────────────────
// 6. NVIDIA / HuggingFace fallbacks
// ──────────────────────────────────────────────
async function callNvidiaFallback(prompt: string, systemInstruction?: string) {
  const baseUrl = getEnvSafe('VITE_BACKEND_URL', () => import.meta.env.VITE_BACKEND_URL as string);
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const response = await fetch(`${baseUrl}/api/nvidia/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "meta/llama-3.2-90b-vision-instruct",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterStr = response.headers.get('Retry-After');
      let retryDelayMs = 5000;
      if (retryAfterStr) {
        const parsed = parseInt(retryAfterStr, 10);
        if (!isNaN(parsed)) {
          retryDelayMs = parsed * 1000;
        } else {
          const date = new Date(retryAfterStr);
          if (!isNaN(date.getTime())) {
            retryDelayMs = Math.max(date.getTime() - Date.now(), 5000);
          }
        }
      }
      throw new ApiRateLimitError(`NVIDIA API Rate Limit Exceeded`, retryDelayMs);
    }
    const errTextRaw = await response.text();
    let errText = errTextRaw;
    try {
      const errObj = JSON.parse(errTextRaw);
      if (errObj.error) errText = typeof errObj.error === 'string' ? errObj.error : JSON.stringify(errObj.error);
    } catch (e) {}
    throw new Error(`NVIDIA API Error: ${errText}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content;
  content = content.replace(/^```json\\n?/, '').replace(/\\n?```$/, '').trim();
  return content;
}

async function callNvidiaVisionFallback(base64Data: string, mimeType: string, prompt: string) {
  const baseUrl = getEnvSafe('VITE_BACKEND_URL', () => import.meta.env.VITE_BACKEND_URL as string);
  const response = await fetch(`${baseUrl}/api/nvidia/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "meta/llama-3.2-90b-vision-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
               type: "image_url",
               image_url: {
                 url: `data:${mimeType};base64,${base64Data}`
               }
            }
          ]
        }
      ],
      temperature: 0.2,
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterStr = response.headers.get('Retry-After');
      let retryDelayMs = 5000;
      if (retryAfterStr) {
        const parsed = parseInt(retryAfterStr, 10);
        if (!isNaN(parsed)) {
          retryDelayMs = parsed * 1000;
        } else {
          const date = new Date(retryAfterStr);
          if (!isNaN(date.getTime())) {
            retryDelayMs = Math.max(date.getTime() - Date.now(), 5000);
          }
        }
      }
      throw new ApiRateLimitError(`NVIDIA Vision API Rate Limit Exceeded`, retryDelayMs);
    }
    const errTextRaw = await response.text();
    let errText = errTextRaw;
    try {
      const errObj = JSON.parse(errTextRaw);
      if (errObj.error) errText = typeof errObj.error === 'string' ? errObj.error : JSON.stringify(errObj.error);
    } catch (e) {}
    throw new Error(`NVIDIA Vision API Error: ${errText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ──────────────────────────────────────────────
// 7. Unified callers – try paid API first, fall back to NVIDIA
// ──────────────────────────────────────────────
export async function callLLM(
  prompt: string,
  systemInstruction?: string,
  responseFormat?: 'json_object' | 'text',
  maxTokens?: number,
): Promise<string> {
  if (hasKey(DEEPSEEK_KEY)) {
    try { return await callDeepSeek(prompt, systemInstruction, responseFormat, maxTokens); } catch (e) { console.warn('DeepSeek failed, falling back to Gemini', e); }
  }
  if (hasKey(GEMINI_KEY)) {
    try { return await callGeminiFlashLite(prompt, systemInstruction); } catch (e) { console.warn('Gemini failed, falling back to NVIDIA', e); }
  }
  return callNvidiaFallback(prompt, systemInstruction);
}

// ──────────────────────────────────────────────
// 8. JSON repair helper for truncated responses
// ──────────────────────────────────────────────
function repairTruncatedJson(jsonString: string): string {
  try {
    return jsonrepair(jsonString);
  } catch (err) {
    console.warn("jsonrepair library failed, falling back to custom bracket-repair logic");
    let repaired = jsonString.replace(/,\s*([}\]])/g, '$1');
    
    let openBrackets = 0, closeBrackets = 0;
    let openBraces = 0, closeBraces = 0;
    let inString = false;
    
    for (let i = 0; i < repaired.length; i++) {
      const char = repaired[i];
      if (char === '"' && (i === 0 || repaired[i - 1] !== '\\')) {
        inString = !inString;
      } else if (!inString) {
        if (char === '[') openBrackets++;
        if (char === ']') closeBrackets++;
        if (char === '{') openBraces++;
        if (char === '}') closeBraces++;
      }
    }
    
    if (inString) repaired += '"';
    
    while (closeBrackets < openBrackets) { repaired += ']'; closeBrackets++; }
    while (closeBraces < openBraces) { repaired += '}'; closeBraces++; }
    
    return repaired;
  }
}

// ──────────────────────────────────────────────
// 9. Public functions (Metadata, Outline, Chat, etc.)
// ──────────────────────────────────────────────

export async function generateBatchChapterMetadata(
  chaptersData: { content: string; chapterNumber: number }[],
  retries = 3,
  summaryDetail: 'brief' | 'detailed' | 'academic' = 'detailed',
): Promise<{ [chapterNumber: number]: { title: string; summary: string } }> {
  const chaptersText = chaptersData
    .map(c => `--- Chapter ${c.chapterNumber} ---
${c.content.substring(0, 75000)}`)
    .join('\\n\\n');

  let instructions = '';
  if (summaryDetail === 'brief') {
    instructions = 'Provide a very brief summary (2-3 short bullet points) highlighting only the most critical takeaway.';
  } else if (summaryDetail === 'academic') {
    instructions = "You must provide a rigorous, comprehensive academic summary. First, write a substantive overview paragraph of at least 150 words that introduces the research area, core thesis, and overall significance. Then, you MUST generate exactly 5-6 detailed bullet points, each of which must be 2-3 complete sentences long and thoroughly explain a distinct concept, theory, or finding with academic depth. Expand on each point. This summary is intended for a scholarly audience.";
  } else {
    instructions = "You must provide a thorough and detailed summary. This is critically important. First, write a comprehensive overview paragraph of at least 150 words that captures the core thesis, methodology, and key findings. Then, you MUST generate exactly 5-6 detailed bullet points, each of which must be 2-3 complete sentences long and cover a distinct key concept, argument, or result. Do not be brief. Expand on each point thoroughly. This summary must be suitable for a university-level textbook.";
  }

  const prompt = `
Analyze the following text which contains multiple chapters. You are an expert analyst. 
For each chapter, generate:
1. A highly descriptive, context-relevant title that accurately reflects the exact topic, key findings, or primary theme of the chapter (max 8 words). Avoid generic titles like "Introduction" or "Conclusion" if possible; instead, summarize the specific focus (e.g., "Introduction to Quantum Mechanics" rather than just "Introduction").
2. ${instructions}

Here are the chapters:
${chaptersText}

IMPORTANT: You must return ONLY a valid JSON object where the keys are the chapter numbers (as strings) and values are objects with 'title' and 'summary' keys. Example:
{
  "\${chaptersData[0]?.chapterNumber || '1'}": { "title": "Example Descriptive Title", "summary": "Overview paragraph...\\n\\n- Bullet point 1...\\n- Bullet point 2..." }
}
No markdown formatting, no explanation.
  `.trim();

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const raw = await callLLM(prompt, undefined, 'json_object', 8192);
      const parsed = JSON.parse(raw);
      
      const result: { [chapterNumber: number]: { title: string, summary: string } } = {};
      
      for (const key in parsed) {
        let summaryObj = parsed[key].summary;
        if (Array.isArray(summaryObj)) {
          summaryObj = summaryObj.join("\\n- ");
          if (!summaryObj.startsWith("- ")) summaryObj = "- " + summaryObj;
        } else if (typeof summaryObj === 'string') {
          summaryObj = summaryObj.replace(/\\n/g, '\\n');
          if (!summaryObj.trim().startsWith('-')) {
            summaryObj = '- ' + summaryObj.trim();
          }
        }
        
        const numericMatch = key.match(/\d+/);
        const chapterNum = numericMatch ? parseInt(numericMatch[0], 10) : parseInt(key, 10);
        
        result[chapterNum] = {
          title: parsed[key].title,
          summary: summaryObj
        };
      }
      return result;
    } catch (error: any) {
      console.warn(`[Retry Notice] Attempt ${attempt + 1} failed for batch (will auto-retry):`, error);
      if (attempt === retries - 1) {
        if (error instanceof ApiRateLimitError) throw error;
        throw new Error(cleanErrorMessage(error));
      }
      
      let delay = Math.pow(2, attempt) * 4000;
      if (error instanceof ApiRateLimitError) {
        delay = Math.max(delay, error.retryAfterMs);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Failed to generate metadata after multiple attempts.');
}

export async function generateChapterMetadata(
  content: string,
  chapterNumber: number,
  retries = 3,
  summaryDetail: 'brief' | 'detailed' | 'academic' = 'detailed'
): Promise<{title: string; summary: string}> {
  let instructions = "";
  if (summaryDetail === 'brief') {
    instructions = "Provide a very brief summary (2-3 short bullet points) highlighting only the most critical takeaway.";
  } else if (summaryDetail === 'academic') {
    instructions = "You must provide a rigorous, comprehensive academic summary. First, write a substantive overview paragraph of at least 150 words that introduces the research area, core thesis, and overall significance. Then, you MUST generate exactly 5-6 detailed bullet points, each of which must be 2-3 complete sentences long and thoroughly explain a distinct concept, theory, or finding with academic depth. Expand on each point. This summary is intended for a scholarly audience.";
  } else {
    instructions = "You must provide a thorough and detailed summary. This is critically important. First, write a comprehensive overview paragraph of at least 150 words that captures the core thesis, methodology, and key findings. Then, you MUST generate exactly 5-6 detailed bullet points, each of which must be 2-3 complete sentences long and cover a distinct key concept, argument, or result. Do not be brief. Expand on each point thoroughly. This summary must be suitable for a university-level textbook.";
  }

  const prompt = `
Analyze the following text (Chapter ${chapterNumber}). You are an expert analyst.
Generate a highly descriptive, context-relevant title that accurately reflects the exact topic, key findings, or primary theme of the chapter (max 8 words). Avoid generic titles like "Introduction" or "Conclusion" if possible.
${instructions}

Text:
${content.substring(0, 10000)}

IMPORTANT: You must return ONLY a valid JSON object with 'title' and 'summary' keys. Example:
{
  "title": "Example Descriptive Title",
  "summary": "Overview paragraph...\\n\\n- Bullet point 1...\\n- Bullet point 2..."
}
No markdown formatting, no explanation.
  `.trim();

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const raw = await callLLM(prompt, undefined, 'json_object', 8192);
      const parsed = JSON.parse(raw);
      let summaryObj = parsed.summary;
      if (Array.isArray(summaryObj)) {
        summaryObj = summaryObj.join("\\n- ");
        if (!summaryObj.startsWith("- ")) summaryObj = "- " + summaryObj;
      } else if (typeof summaryObj === 'string') {
        summaryObj = summaryObj.replace(/\\n/g, '\\n');
        if (!summaryObj.trim().startsWith('-')) {
          summaryObj = '- ' + summaryObj.trim();
        }
      }
      return { title: parsed.title, summary: summaryObj };
    } catch (error: any) {
      console.error(`Attempt ${attempt + 1} failed for chapter ${chapterNumber}:`, error);
      if (attempt === retries - 1) {
        if (error instanceof ApiRateLimitError) throw error;
        throw new Error(cleanErrorMessage(error));
      }
      
      let delay = Math.pow(2, attempt) * 2000;
      if (error instanceof ApiRateLimitError) {
        delay = Math.max(delay, error.retryAfterMs);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Failed to generate metadata after multiple attempts.");
}

export async function extractTextFromImage(base64Data: string, mimeType: string): Promise<string> {
  const prompt = "Extract all text from this image. Return only the extracted text, preserving formatting where possible. If there is no text, return an empty string.";

  try {
    return await callNvidiaVisionFallback(base64Data, mimeType, prompt);
  } catch (error: any) {
    if (error instanceof ApiRateLimitError) throw error;
    throw new Error(cleanErrorMessage(error));
  }
}

export async function generateILMChatResponse(
  query: string,
  chapterContent: string,
  history: ChatMessage[]
): Promise<string> {
  const ai = await getGenAI();
  const formattedHistory = history.map(msg => `${msg.role === 'user' ? 'Student' : 'Maya'}: ${msg.text}`).join('\\n\\n');
  const prompt = `You are "Maya", a warm, witty, and encouraging science teacher. 
Context from current lesson step: ${chapterContent.substring(0, 5000)}

Chat History:
${formattedHistory.substring(0, 5000)}

Student Query/Answer: ${query}

Provide a concise, encouraging, and natural conversational response. Acknowledge what the student said, give feedback if it was an answer, and either ask a short follow-up question or gently move the lesson forward. Keep it brief (2-4 sentences max)! Do not output JSON, just plain text. Provide explicit audio emotion tags for the TTS engine. Available tags: [smiling], [excited], [curious], [neutral], [thinking]. Use them at the START of sentences to set the tone.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-preview',
    contents: prompt,
    config: { temperature: 0.7, maxOutputTokens: 250 }
  });
  return response.text.trim();
}

export async function generateChatResponse(
  query: string, 
  chapterContent: string, 
  history: ChatMessage[],
  persona: ReadingPersona = 'general'
) {
  let personaInstruction = "You are an AI Book Reader assistant.";
  if (persona === 'student') {
    personaInstruction = "You are a patient, brilliant tutor. Explain concepts to a student using simple language, clear analogies, and focus on fundamental understanding.";
  } else if (persona === 'academic') {
    personaInstruction = "You are an academic researcher. Discuss this chapter with rigorous language, focusing on underlying theories, logic, methodological strengths/flaws, and broader implications.";
  } else if (persona === 'professional') {
    personaInstruction = "You are an executive assistant. Give a pragmatic executive briefing. Focus solely on action items, core arguments, and real-world takeaways without any fluff.";
  }

  const systemInstruction = `
${personaInstruction}
You are currently helping the user understand provided text, which could be a single chapter or multiple documents.
Answer the user's queries based ONLY on the provided content. If comparing multiple documents, synthesize and cite them.
Maintain conversational memory for follow-up questions.

After every response:
1. Generate 3-5 intelligent follow-up questions relevant to the current chapter that help deeper understanding.
2. Generate a relationship graph of the key concepts discussed in your response (source -> relation -> target).

Output JSON format:
{
  "response": "Your detailed answer here...",
  "followUpQuestions": ["Q1", "Q2", "Q3"],
  "relationshipGraph": [
    { "source": "Concept A", "target": "Concept B", "relation": "causes" }
  ]
}
  `.trim();

  const formattedHistory = history.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`).join('\\n\\n');

  const prompt = `
Provided Content:
${chapterContent.substring(0, 25000)}

Chat History:
${formattedHistory.substring(0, 5000)}

User Query: ${query}

IMPORTANT: You must return ONLY a valid JSON object with 'response', 'followUpQuestions' (array of strings), and 'relationshipGraph' (array of objects with source, target, relation) keys. No markdown formatting, no explanation.
  `.trim();

  try {
    const raw = await callLLM(prompt, systemInstruction, 'json_object');
    return JSON.parse(raw) as {
      response: string;
      followUpQuestions: string[];
      relationshipGraph: { source: string; target: string; relation: string }[];
    };
  } catch (error: any) {
    if (error instanceof ApiRateLimitError) throw error;
    throw new Error(cleanErrorMessage(error));
  }
}

/**
 * AI Outline Generation - extracts Table of Contents headings exactly as requested.
 */
export async function generateOutline(text: string): Promise<{title: string, subtopics: string[]}[]> {
  // Prompts exactly as requested (with typo fixed: 'ou' -> 'You')
  const prompt = `You are a document structure analyst. Extract the table of contents from the following text.
Return a JSON array of chapter objects. Each object must have:
"title": the exact chapter/unit/section heading as it appears in the text.
"subtopics": an array of strings, each an exact subtopic heading under that chapter (preserve numbering like "a. Input", "1.1 Introduction").
If the text contains only chapters with no subtopics, the "subtopics" array may be empty.
If no clear chapter structure is found, return an empty array.
Do NOT include any content text, only headings.

Text:
${text.substring(0, 40000)}`;

  try {
    const raw = await callLLM(prompt, "You are a document structure analyst.", "json_object");
    const jsonStr = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);
    return Array.isArray(result) ? result : [];
  } catch (err) {
    console.error("[generateOutline] Failed to generate outline", err);
    return [];
  }
}

export async function generateDocumentHierarchy(content: string, detectedHeadings?: string[], retries = 3): Promise<any> {
  const headingsPrompt = detectedHeadings && detectedHeadings.length > 0 
    ? `
The document contains exactly these main sections in this order:
${detectedHeadings.map(h => `- ${h}`).join('\\n')}

You MUST use these exact titles and preserve this exact order when building your hierarchy.
`
    : '';

  const prompt = `
You are an expert textbook editor processing a raw document dump.
Analyze the following text and automatically generate a nested hierarchical structure (Parts -> Chapters -> Topics) for the document.${headingsPrompt}
The output MUST be a valid JSON matching this structure exactly:
{
  "parts": [
    {
      "title": "Part 1: Example Part",
      "summary": "A highly detailed, comprehensive paragraph summarizing the entire part (at least 3-4 sentences).",
      "chapters": [
        {
          "title": "Chapter 1 – Example Chapter",
          "summary": "A highly detailed, thorough paragraph summarizing the chapter, capturing main ideas, entities, and arguments.",
          "topics": [
            { "title": "Topic 1A: Example Topic", "content": "The actual full original textual content for this topic. Do not omit any sentences. Copy it exactly.", "summary": "A very detailed summary of this specific topic in multiple sentences." }
          ]
        }
      ]
    }
  ]
}

CRITICAL RULES:
1. "content" fields MUST contain the actual full, verbatim text from the source without skipping, truncating, or summarizing.
2. "summary" fields MUST be comprehensive, high-quality, long summaries (multiple sentences emphasizing key learning points).
3. If the text is short, you can just return chapters, or just topics. Maintain the JSON array structure.
4. Ensure absolutely ZERO content from the source text is lost. Every paragraph must end up in a topic's "content" field.
5. If the document appears to be a research paper, avoid creating separate parts for references and acknowledgements; instead group them under the last chapter or a single 'Supplementary Material' section.

Source Text:
${content.substring(0, 35000)}
  `.trim();

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const raw = await callLLM(prompt, undefined, 'json_object', 16384);
      let parsed;
      
      try {
        parsed = JSON.parse(raw);
      } catch (parseError) {
        console.warn(`JSON parse failed on attempt ${attempt + 1}, attempting repair...`);
        const repaired = repairTruncatedJson(raw);
        try {
          parsed = JSON.parse(repaired);
        } catch (repairError) {
          throw new Error('JSON repair failed, retrying full generation...');
        }
      }

      // POST-PROCESSING LOGIC
      if (parsed && Array.isArray(parsed.parts)) {
        // 1. Remove empty / placeholder headings
        parsed.parts = parsed.parts.filter((p: any) => {
          if (p.title?.includes('Main Text') && (!p.chapters || p.chapters.length === 0)) return false;
          return true;
        });

        parsed.parts.forEach((p: any) => {
          if (Array.isArray(p.chapters)) {
            // Remove empty chapters
            p.chapters = p.chapters.filter((c: any) => {
              if (c.title?.includes('Main Text') && (!c.topics || c.topics.length === 0)) return false;
              return true;
            });

            // 2. Merge duplicate Conclusion chapters
            const mergedChapters: any[] = [];
            for (let c of p.chapters) {
              const lowerTitle = (c.title || '').toLowerCase();
              if (lowerTitle.includes('conclusion')) {
                const existing = mergedChapters.find(mc => (mc.title || '').toLowerCase().includes('conclusion'));
                if (existing) {
                  if (c.topics) {
                    existing.topics = [...(existing.topics || []), ...c.topics];
                  }
                  existing.summary = (existing.summary || '') + ' ' + (c.summary || '');
                  continue;
                }
              }
              mergedChapters.push(c);
            }
            p.chapters = mergedChapters;
          }
        });

        // 3. Merge isolated References part into the previous part
        const partsToKeep: any[] = [];
        for (let i = 0; i < parsed.parts.length; i++) {
          const p = parsed.parts[i];
          const lowerTitle = (p.title || '').toLowerCase();
          if (lowerTitle.includes('reference') && i > 0) {
            const prev = partsToKeep[partsToKeep.length - 1];
            if (p.chapters) {
              prev.chapters = [...(prev.chapters || []), ...p.chapters];
            }
          } else {
            partsToKeep.push(p);
          }
        }
        parsed.parts = partsToKeep;
      }
      
      return parsed;
    } catch (error: any) {
      console.warn(`Attempt ${attempt + 1} failed for hierarchy generation:`, error);
      if (attempt === retries - 1) {
        if (error instanceof ApiRateLimitError) throw error;
        throw new Error(cleanErrorMessage(error));
      }
      
      let delay = Math.pow(2, attempt) * 4000;
      if (error instanceof ApiRateLimitError) {
        delay = Math.max(delay, error.retryAfterMs);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export async function generateActionTool(chapterContent: string, toolType: 'quiz' | 'glossary' | 'brief' | 'followup') {
  let promptText = "";
  let jsonFormatInstructions = "";

  if (toolType === 'quiz') {
    promptText = "Generate a multiple-choice quiz based on the core concepts of this chapter to test understanding.";
    jsonFormatInstructions = "{ 'questions': [{ 'question': '...','options': ['A','B','C','D'], 'answerIndex': 0, 'explanation': '...' }] }";
  } else if (toolType === 'glossary') {
    promptText = "Extract the most important specialized terms or complex concepts from this chapter and provide clear definitions.";
    jsonFormatInstructions = "{ 'terms': [{ 'term': '...', 'definition': '...' }] }";
  } else if (toolType === 'brief') {
    promptText = "Generate an executive briefing from this chapter. It must include action items, key arguments, and a short memo-style summary.";
    jsonFormatInstructions = "{ 'summaryMemo': '...', 'actionItems': ['...'], 'keyArguments': ['...'] }";
  } else if (toolType === 'followup') {
    promptText = "Generate exactly 10-12 strictly aligned follow-up questions to explore the chapter content further.";
    jsonFormatInstructions = "{ 'questions': ['Question 1...', 'Question 2...'] }";
  }

  const prompt = `
Task: ${promptText}

Chapter Content:
${chapterContent.substring(0, 25000)}

IMPORTANT: You must return ONLY a valid JSON object exactly matching this structure: ${jsonFormatInstructions}. No markdown formatting, no explanation.
  `.trim();

  try {
    const raw = await callLLM(prompt, undefined, 'json_object');
    return JSON.parse(raw);
  } catch (error: any) {
    if (error instanceof ApiRateLimitError) throw error;
    throw new Error(cleanErrorMessage(error));
  }
}

// ──────────────────────────────────────────────
// 10. NEW public functions (TTS, STT, Video)
// ──────────────────────────────────────────────
export async function synthesizeSpeech(text: string, voiceName?: string): Promise<string> {
  if (!hasKey(GEMINI_KEY)) throw new Error('Gemini API key required for TTS');
  return callGeminiTTS(text, voiceName);
}

export async function transcribeSpeech(audioBlob: Blob): Promise<string> {
  if (!hasKey(EL_KEY)) throw new Error('ElevenLabs API key required for STT');
  return callElevenLabsSTT(audioBlob);
}

export async function generateTopicVideo(
  prompt: string,
  aspectRatio: '16:9' | '9:16' = '16:9',
): Promise<string> {
  if (!hasKey(GEMINI_KEY)) throw new Error('Gemini API key required for Veo');
  return callVeo31Lite(prompt, aspectRatio);
}

// ──────────────────────────────────────────────
// 11. PCM → WAV helper (for Gemini TTS)
// ──────────────────────────────────────────────
function pcmToWavBase64(rawBase64: string, mimeType: string): string {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  const rawBytes = Uint8Array.from(atob(rawBase64), c => c.charCodeAt(0));
  const dataSize = rawBytes.length;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const wavBytes = new Uint8Array(buffer);
  wavBytes.set(rawBytes, headerSize);

  let binary = '';
  for (let i = 0; i < wavBytes.length; i++) binary += String.fromCharCode(wavBytes[i]);
  return btoa(binary);
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

// ──────────────────────────────────────────────
// Extra Terminology Extractor function
// ──────────────────────────────────────────────
export async function extractTerminology(content: string, customPrompt?: string): Promise<{ term: string; definition: string }[]> {
  const defaultTask = "Identify and extract the most important technical terms, vocabulary, jargon, names of systems, key equations, concepts, or events from the provided text, and provide clear, precise, and educational definitions suited for study and flashcards.";
  const prompt = `
Task: ${customPrompt || defaultTask}

Source Text Content:
${content.substring(0, 30000)}

IMPORTANT: You must return ONLY a valid JSON object matching this structure:
{
  "terms": [
    { "term": "Term Name", "definition": "A clear, concise, and thorough definition or explanation of the term." }
  ]
}
No markdown formatting, no explanations outside of the JSON block.
  `.trim();

  try {
    const raw = await callLLM(prompt, undefined, 'json_object');
    const parsed = JSON.parse(raw);
    return parsed.terms || [];
  } catch (error: any) {
    if (error instanceof ApiRateLimitError) throw error;
    throw new Error(error.message || "Failed to extract terminology.");
  }
}

// ──────────────────────────────────────────────
// 12. Ultra-minimal fallback summarizer
// ──────────────────────────────────────────────
export async function generateMinimalSummary(text: string): Promise<string> {
  const prompt = `Summarise this text in one sentence:

${text.substring(0, 4000)}`;
  try {
    return await callLLM(prompt, undefined, 'text', 1024);
  } catch (err) {
    console.error('Minimal fallback summarize failed:', err);
    return 'Summary temporarily unavailable – please try again later.';
  }
}

// ──────────────────────────────────────────────
// 13. DeepSeek JSON document restructuring
// ──────────────────────────────────────────────
export async function extractViaAI(text: string): Promise<any[] | null> {
  // Ensure we pass the text WITHOUT any prompt comments attached
  const cleanText = text.substring(0, 350000); 
  
  const prompt = `
You are a textbook parsing engine. The provided text has already been cleaned of all front matter, Table of Contents, and non-chapter garbage.
Your ONLY task is to parse the text into a clean hierarchical JSON structure.

STRICT RULES TO FOLLOW:
1. DO NOT summarize, omit, or change any text. Copy the original text verbatim.
2. The output MUST be a JSON object with a single key "parts". Its value is an array of part objects.
3. Each part MUST have: "title" (string), "chapters" (array of chapter objects).
4. Each chapter MUST have: "title" (string), "topics" (array of topic objects).
5. Each topic MUST have: "title" (string), "content" (string – the EXACT original text for that section).
6. **CRITICAL: You MUST split the chapter's text into multiple distinct topics.** Look for the following sub-heading patterns:
   - Single lowercase letter followed by a dot and a space (e.g., "a. Input", "b. Process", "c. Output").
   - Roman numerals followed by a dot and a space (e.g., "i. Difference Engine", "ii. Analytical Engine").
   - Numbers followed by a dot and a space (e.g., "1.1 Introduction", "2.3 Storage").
   - Any bold or indented headings.
   - Create a separate topic for each sub-section.
   - The "content" of each topic must be the exact text starting after that sub-heading until the next sub-heading.
7. If the text contains "Exercise", "Exercises", or "Practice" blocks, create a topic with the title "Exercise" and put that text into its content.
8. Ensure every single character of the text appears exactly once in the output. The sum of all topic contents must equal the original chapter text.

Input text:
${cleanText}

Output only the JSON, no other text.
  `;

  try {
    const raw = await callLLM(prompt, undefined, 'json_object', 131072);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const repaired = jsonrepair(raw);
      parsed = JSON.parse(repaired);
    }
    return parsed?.parts || null;
  } catch (e) {
    console.error('extractViaAI failed:', e);
    return null;
  }
}
