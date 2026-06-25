const fs = require('fs');
const lines = fs.readFileSync('src/lib/gemini.ts', 'utf8').split('\n');

const topPart = lines.slice(0, 921).join('\n');

const bottomPart = `function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

// ──────────────────────────────────────────────
// Extra Terminology Extractor function
// ──────────────────────────────────────────────
export async function extractTerminology(content: string, customPrompt?: string): Promise<{ term: string; definition: string }[]> {
  const defaultTask = "Identify and extract the most important technical terms, vocabulary, jargon, names of systems, key equations, concepts, or events from the provided text, and provide clear, precise, and educational definitions suited for study and flashcards.";
  const prompt = \\\`
Task: \\\${customPrompt || defaultTask}

Source Text Content:
\\\${content.substring(0, 30000)}

IMPORTANT: You must return ONLY a valid JSON object matching this structure:
{
  "terms": [
    { "term": "Term Name", "definition": "A clear, concise, and thorough definition or explanation of the term." }
  ]
}
No markdown formatting, no explanations outside of the JSON block.
  \\\`.trim();

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
  const prompt = \\\`Summarise this text in one sentence:

\\\${text.substring(0, 4000)}\\\`;
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
  
  const prompt = \\\`
You are a document parsing AI. The provided text is a book.
Your task is to extract the EXACT textbook hierarchy into a JSON array.

STRICT RULES:
1. DO NOT summarize, change, or omit ANY text. Copy the text verbatim.
2. Output a JSON array of chapters. Each chapter has:
   - "title": The exact chapter heading.
   - "subtopics": An array of { "title": string, "content": string }.
   - "exercises": An array of { "title": string, "content": string }.

3. **CHAPTER IDENTIFICATION:** Analyze the text to find the main chapter headings. These could be "Unit", "Chapter", "Part", "Section", "Lesson", or numbered headings like "1. Introduction".

4. **SUB-TOPIC IDENTIFICATION:** For each chapter, scan the text for sub-headings. Sub-headings can be ANY of the following:
   - A lowercase letter followed by a dot (e.g., "a. Abacus", "b. Napier's Bone").
   - A roman numeral followed by a dot (e.g., "i. Difference Engine").
   - A number like "1.1 Introduction" or "2.3 Storage".
   - A bolded or indented line that introduces a new section.
   - ANY line that acts as a break between two distinct blocks of text.

5. Split the chapter into subtopics based on these identified sub-headings. Each sub-heading becomes a separate subtopic. The "content" is the exact text until the next sub-heading.
6. DO NOT treat "Learning Objectives" or "Introduction" as separate subtopics. Merge them into the introductory part of the first subtopic.
7. If you see "Exercise", "Exercises", or "Practice", isolate it and create an exercise node with title "Exercises".

Input text:
\\\${cleanText}

Output only the JSON array, no other text.
\\\`;

  let raw: string;
  try {
    raw = await withRetry(() => callLLM(prompt, undefined, 'json_object', 131072), 3, 5000);
  } catch (e) {
    console.error('extractViaAI callLLM failed:', e);
    return null;
  }

  // --- Aggressive cleaning ---
  let cleanedRaw = raw.replace(/\\\\\\\`\\\\\\\`\\\\\\\`json\\s*/gi, '').replace(/\\\\\\\`\\\\\\\`\\\\\\\`\\s*/gi, '');
  cleanedRaw = cleanedRaw.replace(/,\\s*([}\\]])/g, '$1');
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

  try {
    return mapToTopics(JSON.parse(cleanedRaw));
  } catch {
    try {
      const repaired = jsonrepair(cleanedRaw);
      const parsed = JSON.parse(repaired);
      if (Array.isArray(parsed)) return mapToTopics(parsed);
      if (parsed && typeof parsed === 'object') {
        const possibleArray = Object.values(parsed).find(val => Array.isArray(val));
        if (Array.isArray(possibleArray)) return mapToTopics(possibleArray);
      }
      return null;
    } catch {
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
\`;

fs.writeFileSync('src/lib/gemini.ts', topPart + '\n' + bottomPart);
