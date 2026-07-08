import fs from 'fs';

let content = fs.readFileSync('src/lib/gemini.ts', 'utf-8');

const regex = /export async function generateILMChatResponse\([\s\S]*?\}\n/m;
const newFunc = `export async function generateILMChatResponse(
  query: string,
  chapterContent: string,
  history: ChatMessage[]
): Promise<string> {
  const formattedHistory = history.map(msg => \`\${msg.role === 'user' ? 'Student' : 'Maya'}: \${msg.text}\`).join('\\n\\n');
  const prompt = \`You are "Maya", a warm, witty, and encouraging science teacher. 
Context from current lesson step: \${chapterContent.substring(0, 5000)}

Chat History:
\${formattedHistory.substring(0, 5000)}

Student Query/Answer: \${query}

Provide a concise, encouraging, and natural conversational response. Acknowledge what the student said, give feedback if it was an answer, and either ask a short follow-up question or gently move the lesson forward. Keep it brief (2-4 sentences max)! Do not output JSON, just plain text. Provide explicit audio emotion tags for the TTS engine. Available tags: [smiling], [excited], [curious], [neutral], [thinking]. Use them at the START of sentences to set the tone.\`;

  return await callLLM(prompt, undefined, 'text', 250, 0.7);
}
`;

content = content.replace(regex, newFunc);
fs.writeFileSync('src/lib/gemini.ts', content);
