import fs from 'fs';
const content = fs.readFileSync('src/lib/gemini.ts', 'utf8');
const lines = content.split('\n');
const replacement = `// ──────────────────────────────────────────────
// Extra Terminology Extractor function
// ──────────────────────────────────────────────
export async function extractTerminology(content: string, customPrompt?: string): Promise<{ term: string; definition: string }[]> {
  const defaultTask = "Identify and extract the most important technical terms, vocabulary, jargon, names of systems, key equations, concepts, or events from the provided text, and provide clear, precise, and educational definitions suited for study and flashcards.";
  const prompt = \\\`
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
  \\\`.trim();`;

const newLines = [
  ...lines.slice(0, 888),
  ...replacement.split('\\n'),
  ...lines.slice(914)
];
fs.writeFileSync('src/lib/gemini.ts', newLines.join('\\n'));
console.log('Fixed');
