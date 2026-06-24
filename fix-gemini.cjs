const fs = require('fs');

const lines = fs.readFileSync('src/lib/gemini.ts', 'utf8').split('\n');
const topPart = lines.slice(0, 862).join('\n');

const bottomPart = `// ──────────────────────────────────────────────
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
You are a strict textbook parser. The text provided starts exactly at the first chapter heading.
Your task is to output a JSON array of chapters.

**STRICT RULES:**
1. DO NOT summarize, change, or omit ANY original text. Copy it verbatim.
2. The output MUST be a JSON array of chapter objects. Each chapter has:
   - "title": The exact chapter heading.
   - "subtopics": An array of objects with "title" and "content".
   - "exercises": An array of objects with "title" and "content" (if none, provide empty array).

3. **SUB-TOPIC RULE:** Split chapter text into subtopics based on the EXACT delimiters:
   - A single lowercase letter followed by a dot and a space (e.g., "a. Input", "b. Process").
   - A Roman numeral followed by a dot and a space (e.g., "i. Difference Engine", "ii. Analytical Engine").
   - Each delimited section becomes a separate subtopic.
   - Combine "Learning Objectives" and "Introduction" into the first subtopic's content.

4. **EXERCISE RULE:** If you encounter "Exercise", create an exercise object with title "Exercises" and content as the exact text.

5. Ensure every character appears exactly once across all subtopics and exercises.

Output only the JSON array, no other text.

Input text:
\${cleanText}
\`;

  let raw: string;
  try {
    raw = await withRetry(() => callLLM(prompt, undefined, 'json_object', 131072), 3, 5000);
  } catch (e) {
    console.error('extractViaAI callLLM failed:', e);
    return null;
  }

  // --- Aggressive cleaning ---
  // 1. Remove markdown code blocks
  let cleanedRaw = raw.replace(/\\\`\\\`\\\`json\\s*/gi, '').replace(/\\\`\\\`\\\`\\s*/gi, '');
  // 2. Remove trailing commas before closing brackets
  cleanedRaw = cleanedRaw.replace(/,\\s*([}\\]])/g, '$1');
  // 3. Remove any leading/trailing whitespace
  cleanedRaw = cleanedRaw.trim();

  const mapToTopics = (arr: any[]) => {
    return arr.map((chap: any) => {
      const topics: any[] = [];
      if (Array.isArray(chap.subtopics)) topics.push(...chap.subtopics);
      if (Array.isArray(chap.exercises)) topics.push(...chap.exercises);
      if (Array.isArray(chap.topics)) topics.push(...chap.topics);
      return {
        title: chap.title,
        content: chap.content,
        topics
      };
    });
  };

  // --- Attempt parsing ---
  try {
    // Try standard parse first
    return mapToTopics(JSON.parse(cleanedRaw));
  } catch {
    try {
      // Try jsonrepair
      const repaired = jsonrepair(cleanedRaw);
      const parsed = JSON.parse(repaired);
      if (Array.isArray(parsed)) return mapToTopics(parsed);
      // If it's an object with an array inside, extract it
      if (parsed && typeof parsed === 'object') {
        const possibleArray = Object.values(parsed).find(val => Array.isArray(val));
        if (Array.isArray(possibleArray)) return mapToTopics(possibleArray);
      }
      return null;
    } catch {
      // Final fallback: try to extract an array using regex
      const arrayMatch = cleanedRaw.match(/\\[\\s*\\{[\\s\\S]*\\}\\s*\\]/);
      if (arrayMatch) {
        try {
          const extracted = JSON.parse(arrayMatch[0]);
          if (Array.isArray(extracted)) return mapToTopics(extracted);
        } catch {}
      }
      return null;
    }
  }
}
`;

fs.writeFileSync('src/lib/gemini.ts', topPart + '\n' + bottomPart);
