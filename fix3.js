const fs = require('fs');
const content = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const startStr = 'export async function synthesizeSpeech';
const startIdx = content.indexOf(startStr);

if (startIdx === -1) {
  console.log('failed to find start');
  process.exit(1);
}

const replacement = `export async function synthesizeSpeech(text: string, voiceName?: string): Promise<string> {
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
  const prompt = \`
Task: \${customPrompt || defaultTask}

Source Text Content:
\${content.substring(0, 30000)}

IMPORTANT: You must return ONLY a valid JSON object matching this structure:
{
  "terms": [
    { "term": "Term Name", "definition": "A clear, concise, and thorough definition or explanation of the term." }
  ]
}
No markdown formatting, no explanations outside of the JSON block.
  \`.trim();

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
  const prompt = \`Summarise this text in one sentence:

\${text.substring(0, 4000)}\`;
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
  const cleanText = text.substring(0, 350000); 
  
  const prompt = \`
You are an expert document analyst. Your task is to read the provided textbook text and determine its logical hierarchical structure.

**STRICT RULES:**
1. DO NOT summarize, change, or omit ANY text. Copy the original text verbatim.
2. Every piece of text MUST appear exactly once in the final output.
3. Identify the hierarchy of the book. This could be:
   - Part -> Chapter -> Section
   - Chapter -> Sub-Chapter
   - Unit -> Topic
   - Or any other hierarchy used in the text.
4. Output a generic nested JSON structure where every node has a "title" and "content". 
   - The root is a list of "sections".
   - Each section can have "subsections".
   - "content" must contain the exact text belonging to that node.
   - If a node has children, it should NOT have "content", and vice versa (to prevent duplication).
5. If you identify "Exercise", "Practice", or "Review" blocks, treat them as a leaf node with title "Exercises".
6. Do NOT include Table of Contents, Preface, Abbreviations, or Index in the output.

Example of expected output structure (The AI decides the title names, but the structure must follow this pattern):
{
  "sections": [
    {
      "title": "Unit 1: Introduction To Computer",
      "subsections": [
        { "title": "a. Input", "content": "The full text of Input..." },
        { "title": "b. Process", "content": "The full text of Process..." },
        { "title": "Exercises", "content": "The full text of Exercises..." }
      ]
    },
    {
      "title": "Unit 2: History Of Computer",
      "subsections": [
        { "title": "a. Abacus", "content": "..." },
        { "title": "b. Napier's Bone", "content": "..." }
      ]
    }
  ]
}

Input text:
\\\${cleanText}

Output only the JSON, no other text.
  \`;

  try {
    const raw = await callLLM(prompt, undefined, 'json_object', 131072);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const repaired = jsonrepair(raw);
      parsed = JSON.parse(repaired);
    }
    return parsed?.sections || null;
  } catch (e) {
    console.error('extractViaAI failed:', e);
    return null;
  }
}
`;

const newContent = content.substring(0, startIdx) + replacement;
fs.writeFileSync('src/lib/gemini.ts', newContent);
console.log('Fixed file');
