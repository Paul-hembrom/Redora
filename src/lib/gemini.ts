import OpenAI from 'openai';
import { ChatMessage } from '../types';

// Initialize Groq client (OpenAI‑compatible)
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

// Use a model that is definitely available on Groq
// Common reliable models: 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'
const MODEL_NAME = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

export async function generateChapterMetadata(content: string, chapterNumber: number) {
  const prompt = `
Analyze the following text (Chapter ${chapterNumber}).
Generate a short, meaningful title (max 6 words).
Generate a concise summary (5-10 lines).

Text:
${content.substring(0, 10000)}
  `.trim();

  try {
    const response = await groq.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that outputs valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      // response_format: { type: 'json_object' },  // disabled – some models don't support it
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('No response generated.');

    // Try to parse JSON; if it fails, fallback to extracting from text
    try {
      return JSON.parse(result) as { title: string; summary: string };
    } catch (parseError) {
      console.warn('Response was not valid JSON, attempting to extract manually:', result);
      // Fallback: extract title and summary using regex
      const titleMatch = result.match(/title"?:\s*"?([^"]+)"?/i);
      const summaryMatch = result.match(/summary"?:\s*"?([^"]+)"?/i);
      return {
        title: titleMatch ? titleMatch[1] : `Chapter ${chapterNumber}`,
        summary: summaryMatch ? summaryMatch[1] : 'Summary could not be generated.',
      };
    }
  } catch (error) {
    console.error('Error generating chapter metadata:', error);
    // Re-throw so the caller handles it
    throw new Error(`Failed to generate metadata: ${error.message || 'Unknown error'}`);
  }
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

  try {
    const response = await groq.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      // response_format: { type: 'json_object' },
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('No response generated.');

    try {
      return JSON.parse(result) as {
        response: string;
        followUpQuestions: string[];
        relationshipGraph: { source: string; target: string; relation: string }[];
      };
    } catch (parseError) {
      console.warn('Chat response not valid JSON:', result);
      // Return a basic structure
      return {
        response: result,
        followUpQuestions: [],
        relationshipGraph: [],
      };
    }
  } catch (error) {
    console.error('Error generating chat response:', error);
    throw new Error(`Failed to generate chat response: ${error.message || 'Unknown error'}`);
  }
}