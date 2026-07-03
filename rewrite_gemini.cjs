const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const startIdx = code.indexOf('export async function extractViaAI(text: string');
const endIdx = code.indexOf('export async function extractChapterViaAI');

const prefix = code.substring(0, startIdx);
const suffix = code.substring(endIdx);

const newFn = `export async function extractViaAI(text: string, estimatedChapterCount?: number): Promise<any[] | null> {
  // Fix PDF extraction artifacts where bullet points appear as 'y'
  const preProcessedText = text.replace(/^[ \\t\\xA0]*[yY][ \\t\\xA0]+/gm, '- ');
  const cleanText = preProcessedText; // Do not truncate. 1M context handles full books.
  const prompt = \`\${cleanText}
---
The text is a complete textbook. It contains multiple distinct chapters (or units, parts, sections). Your first task is to identify ALL chapter boundaries.\\n\${estimatedChapterCount ? \`CRITICAL: The text contains exactly \${estimatedChapterCount} chapters (based on the number of chapter/unit headings found). You MUST return EXACTLY that many chapter objects. Do NOT merge chapters. Do NOT skip chapters. If the text has 12 units, you must return 12 chapter objects.\\n\` : ""}
Common chapter markers include: "Unit", "Chapter", "Section", "Part", followed by a number or title, often on a new line or bolded.

Break the text into separate chapters based on these markers. Each chapter must have its own entry in the output JSON.
Do NOT merge multiple chapters into one. If you see "Unit 1", "Unit 2", "Unit 3", etc., create a separate chapter object for each.

Your task is to output a **single JSON object** with a key called "chapters".
The value of "chapters" MUST be an array of chapter objects in the exact order they appear in the source text.

Each chapter object must have:
- "title": The exact chapter heading.
- "subtopics": An array of {"title": "...", "content": "..."}.
- "exercises": An array of {"title": "...", "content": "..."}.

For EVERY chapter, you MUST split the content into subtopics. A subtopic is defined by: numbered/lettered headings (a., b., c., 1., 2., 3., i., ii., iii.), bolded lines, or section breaks. If a chapter has NO detectable subtopics, create a single subtopic titled "Chapter Content" with the full chapter text. NEVER return a chapter with zero subtopics.

For EVERY chapter, you MUST extract ALL exercise content into a separate "exercises" array. Exercise content includes: multiple‑choice questions, true/false, fill‑in‑the‑blanks, match the following, short answer, long answer, project work, "Let's Revise", "Write full forms", "Select the best answer", "Answer the following", "Write technical terms", and similar question sections.

The exercises array must contain exactly ONE object with "title": "Chapter Exercises" and "content": the FULL exercise text, formatted with #### Markdown headings before each exercise type (e.g., #### Select the best answer, #### Write full forms).
Do NOT split exercises into multiple sub‑entries; keep everything in one block.

If the original text contains tables (comparison tables, feature lists, tree structures, etc.), you MUST convert them to Markdown table format (using pipes | and dashes -). Preserve all rows and columns exactly. Do NOT omit or summarize any table content.

CRITICAL RULES:
1. DO NOT summarize, change, or omit ANY text. Copy the text verbatim. EVERY paragraph, every bullet point, every detail must be included in the content strings. THIS IS CRITICAL.
2. Split the text into chapter boundaries based on "Unit", "Chapter", "Section", "Part".
3. PRESERVE ORDER: The chapters in the array MUST be in the exact sequence they appear in the source text. Do NOT sort alphabetically.
4. Split subtopics based on EXACT delimiters: a., b., c., 1.1, i., ii., (a), (b), (i), (ii), and bolded headers. DO NOT merge exercises into subtopics.
5. EXERCISES: If a chapter contains exercises, practice questions, multiple-choice, true/false, fill-in-the-blanks, match the following, short answer, long answer, project work, or similar question sections, place ALL of that content into a SINGLE topic titled "Chapter Exercises" with type "exercise". Do NOT create separate topics for each exercise type. Keep everything together in one block, using #### headings to separate the different types inside the content.
6. If you cannot detect any subtopics, return a single subtopic titled "Chapter Content" containing the full chapter text. NEVER return null.
7. **CRITICAL BULLET FIX:** Normalize ANY corrupted 'y' bullet points into standard hyphens '-'. If a line starts with whitespace followed by a 'y' and a space, convert it to a standard list item. 
8. **COMPARISON TABLES:** If the text contains comparisons or differences between two or more items (e.g., "Difference between X and Y", "X vs Y", comparison lists), format that content as a Markdown table with appropriate column headers. Do NOT leave it as plain paragraphs or bullet lists.
9. IMAGE CAPTIONS: Always place image captions (e.g., "Fig: ...", "Figure: ...") on their own separate line. Never run them together with other text or with other captions.
10. TECHNICAL TERMS: If a chapter contains a "Technical Terms", "Glossary", "Key Terms", "Vocabulary", "Important Terms", or similar section, place ALL of that content into a SINGLE topic titled "Technical Terms" with type "glossary". Format the content as a Markdown table with two columns: "Term" and "Definition". Do NOT create separate topics for individual terms.
Output only the JSON object containing the "chapters" array. No other text.
\`;

  let raw: string;
  try {
    console.log(\`[extractViaAI] Starting text extraction. Text length: \${cleanText.length}, expected chapters: \${estimatedChapterCount || 'unknown'}\`);
    raw = await withRetry(() => callLLM(prompt, undefined, 'json_object', 384000, 0), 3, 5000);
  } catch (e) {
    console.error('[extractViaAI] callLLM failed:', e);
    return null;
  }

  // --- Aggressive cleaning ---
  let cleanedRaw = raw.replace(/\`\`\`json\\s*/gi, '').replace(/\`\`\`\\s*/gi, '');
  cleanedRaw = cleanedRaw.replace(/,\\s*([}\\]])/g, '$1');
  cleanedRaw = cleanedRaw.trim();

  const mapToTopics = (arr: any[]) => {
    return arr.map((chap: any) => {
      const topics: any[] = [];
      if (Array.isArray(chap.subtopics)) topics.push(...chap.subtopics.map((t: any) => ({ ...t, type: 'topic' })));
      if (Array.isArray(chap.exercises)) topics.push(...chap.exercises.map((e: any) => ({ ...e, type: 'exercise' })));
      if (Array.isArray(chap.topics)) topics.push(...chap.topics);
      return {
        title: chap.title || 'Untitled Chapter',
        content: chap.content || '',
        topics
      };
    });
  };

  const processExtracted = async (extracted: any[]) => {
    let arr = extracted;
    if (!Array.isArray(extracted) && extracted && typeof extracted === 'object') {
      const possibleArray = Object.values(extracted).find(val => Array.isArray(val));
      if (Array.isArray(possibleArray)) {
        arr = possibleArray;
      } else {
        console.error('[extractViaAI] Could not find chapters array in object:', Object.keys(extracted));
        // Fallback: maybe the object itself is the chapter array but malformed? Just return null.
        return null;
      }
    }
    
    if (!Array.isArray(arr)) return null;
    const mapped = mapToTopics(arr);
    
    console.log(\`[extractViaAI] processExtracted: Got \${mapped.length} chapters. Expected: \${estimatedChapterCount || 'unknown'}\`);

    // Temporarily disable split-retry logic to see if a single pass can process the whole book correctly
    /*
    if (estimatedChapterCount && mapped.length < estimatedChapterCount * 0.8) {
      console.warn(\`Completeness check failed: Got \${mapped.length} chapters, expected \${estimatedChapterCount}. Triggering split-retry...\`);
      
      const mid = Math.floor(cleanText.length / 2);
      const firstHalfText = cleanText.substring(0, mid);
      const secondHalfText = cleanText.substring(mid);
      
      const [firstHalf, secondHalf] = await Promise.all([
        extractViaAI(firstHalfText),
        extractViaAI(secondHalfText)
      ]);
      
      const combined = [];
      if (firstHalf) combined.push(...firstHalf);
      if (secondHalf) combined.push(...secondHalf);
      
      if (combined.length > 0) return combined;
      return null;
    }
    */

    return mapped;
  };

  try {
    const parsed = JSON.parse(cleanedRaw);
    return await processExtracted(parsed);
  } catch (parseError: any) {
    console.log('[extractViaAI] Initial JSON parse failed. Response likely truncated. Error:', parseError.message);
    try {
      console.log('[extractViaAI] Attempting jsonrepair...');
      const repaired = jsonrepair(cleanedRaw);
      const parsed = JSON.parse(repaired);
      console.log('[extractViaAI] jsonrepair succeeded!');
      return await processExtracted(parsed);
    } catch (repairError: any) {
      console.error('[extractViaAI] jsonrepair also failed:', repairError.message);
      const arrayMatch = cleanedRaw.match(/\\[\\s*\\{[\\s\\S]*\\}\\s*\\]/);
      if (arrayMatch) {
        try {
          const extracted = JSON.parse(arrayMatch[0]);
          return await processExtracted(extracted);
        } catch {}
      }
      return null;
    }
  }
}

`;

fs.writeFileSync('src/lib/gemini.ts', prefix + newFn + suffix);
