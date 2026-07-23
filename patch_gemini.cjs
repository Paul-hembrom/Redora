const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const newFunc = `export async function generateNewsSearchQuery(
  subtopicTitle: string,
  content: string
): Promise<string> {
  const contentSnippet = content ? content.substring(0, 1000) : '';
  const prompt = \`Generate a concise, highly specific news search query based on the following educational topic. The query should return recent, relevant news articles that a teacher could use in a classroom.

Topic title: \${subtopicTitle}
Content summary: \${contentSnippet}
Return ONLY the query string, no other text.\`;
  try {
    const text = await callLLM(prompt, false, 0.3);
    return text.replace(/["']/g, '').trim();
  } catch (e) {
    console.error('generateNewsSearchQuery failed:', e);
    return subtopicTitle;
  }
}`;

code = code.replace(/export async function generateNewsSearchQuery[\s\S]*?return subtopicTitle;\n  }\n}/, newFunc);
fs.writeFileSync('src/lib/gemini.ts', code);
