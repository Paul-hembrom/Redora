const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const replacement = `
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
  }
}
`;

code = code.replace(/  try \{\n    return mapToTopics\(JSON\.parse\(cleanedRaw\)\);\n[\s\S]*?      return null;\n    \}\n  \}\n\}/, replacement);
fs.writeFileSync('src/lib/gemini.ts', code);
