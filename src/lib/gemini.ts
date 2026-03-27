import OpenAI from 'openai';
import { ChatMessage } from '../types';

// Initialize Groq client (OpenAI‑compatible)
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

export async function generateChapterMetadata(content: string, chapterNumber: number) {
  const prompt = `
Analyze the following text (Chapter ${chapterNumber}).
Generate a short, meaningful title (max 6 words).
Generate a concise summary (5-10 lines).

Text:
${content.substring(0, 10000)}
  `.trim();

  const response = await groq.chat.completions.create({
    model: 'gpt-oss-120b',          // you can also use 'llama-3.3-70b-versatile' etc.
    messages: [
      { role: 'system', content: 'You are a helpful assistant that outputs valid JSON.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const result = response.choices[0]?.message?.content;
  if (!result) throw new Error('No response generated.');

  return JSON.parse(result) as { title: string; summary: string };
}

export async function generateChatResponse(
  query: string,
  chapterContent: string,
  history: ChatMessage[]
) {
  const systemInstruction = `
You are an AI Book Reader assistant.
You are currently helping the user understand a specific chapter of a book.
Answer the user's queries based ONLY on the provided chapter content.
Maintain conversational memory for follow-up questions within this chapter.

After every response:
1. Generate 3-5 intelligent follow-up questions relevant to the current chapter that help deeper understanding.
2. Generate a relationship graph of the key concepts discussed in your response (source -> relation -> target).

Output JSON format:
{
  "response": "Your detailed answer here...",
  "followUpQuestions": ["Q1", "Q2", "Q3"],
  "relationshipGraph": [
    { "source": "Concept A", "target": "Concept B", "relation": "causes" }
  ]
}
  `.trim();

  const formattedHistory = history.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`).join('\n\n');

  const userPrompt = `
Chapter Content:
${chapterContent}

Chat History:
${formattedHistory}

User Query: ${query}
  `.trim();

  const response = await groq.chat.completions.create({
    model: 'gpt-oss-120b',
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const result = response.choices[0]?.message?.content;
  if (!result) throw new Error('No response generated.');

  return JSON.parse(result) as {
    response: string;
    followUpQuestions: string[];
    relationshipGraph: { source: string; target: string; relation: string }[];
  };
}