const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const newsSearchFunction = `export async function generateNewsSearchQuery(
  subtopicTitle: string,
  content: string
): Promise<string> {
  const prompt = \`Generate a concise news search query based on this educational topic: \${subtopicTitle}.
Optional context: \${content ? content.substring(0, 500) : ''}
Only return the query string.\`;
  try {
    const text = await callLLM(prompt, false, 0.3);
    return text.replace(/["']/g, '').trim();
  } catch (e) {
    console.error('generateNewsSearchQuery failed:', e);
    return subtopicTitle;
  }
}

`;

if (!code.includes('generateNewsSearchQuery')) {
    code = code.replace("export async function extractExercisesForChapter", newsSearchFunction + "export async function extractExercisesForChapter");
    fs.writeFileSync('src/lib/gemini.ts', code);
    console.log("Added generateNewsSearchQuery to src/lib/gemini.ts");
} else {
    console.log("Function already exists.");
}
