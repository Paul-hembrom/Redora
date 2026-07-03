const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const oldPromptRule1 = `1. DO NOT summarize, change, or omit ANY text. Copy the text verbatim.`;
const newPromptRule1 = `1. DO NOT summarize, change, or omit ANY text. Copy the text verbatim. EVERY paragraph, every bullet point, every detail must be included in the content strings. THIS IS CRITICAL.`;
code = code.replace(oldPromptRule1, newPromptRule1);

const oldLogic = `  let raw: string;
  try {
    raw = await withRetry(() => callLLM(prompt, undefined, 'json_object', 384000, 0), 3, 5000);
  } catch (e) {
    console.error('extractViaAI callLLM failed:', e);
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
        title: chap.title,
        content: chap.content,
        topics
      };
    });
  };

  const processExtracted = async (extracted: any[]) => {
    const mapped = mapToTopics(extracted);

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

    return mapped;
  };

  try {
    const parsed = JSON.parse(cleanedRaw);
    return await processExtracted(parsed);
  } catch {
    try {
      const repaired = jsonrepair(cleanedRaw);
      const parsed = JSON.parse(repaired);
      if (Array.isArray(parsed)) return await processExtracted(parsed);
      if (parsed && typeof parsed === 'object') {
        const possibleArray = Object.values(parsed).find(val => Array.isArray(val));
        if (Array.isArray(possibleArray)) return await processExtracted(possibleArray);
      }
      return null;
    } catch {
      const arrayMatch = cleanedRaw.match(/\\[\\s*\\{[\\s\\S]*\\}\\s*\\]/);
      if (arrayMatch) {
        try {
          const extracted = JSON.parse(arrayMatch[0]);
          if (Array.isArray(extracted)) return await processExtracted(extracted);
        } catch {}
      }
      return null;
    }
  }`;

const newLogic = `  let raw: string;
  try {
    console.log(\`[extractViaAI] Starting text extraction. Text length: \${cleanText.length}, expected chapters: \${estimatedChapterCount || 'unknown'}\`);
    raw = await withRetry(() => callLLM(prompt, undefined, 'json_object', 384000, 0), 3, 5000);
  } catch (e) {
    console.error('extractViaAI callLLM failed:', e);
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
  } catch (parseError) {
    console.log('[extractViaAI] Initial JSON parse failed. Response likely truncated. Error:', parseError.message);
    try {
      console.log('[extractViaAI] Attempting jsonrepair...');
      const repaired = jsonrepair(cleanedRaw);
      const parsed = JSON.parse(repaired);
      console.log('[extractViaAI] jsonrepair succeeded!');
      return await processExtracted(parsed);
    } catch (repairError) {
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
  }`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('src/lib/gemini.ts', code);
