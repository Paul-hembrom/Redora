import { GoogleGenAI, Type } from '@google/genai';
import { ChatMessage } from '../types';

export async function generateChapterMetadata(content: string, chapterNumber: number, retries = 3): Promise<{title: string, summary: string}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null' || apiKey === '') {
    console.error("GEMINI_API_KEY is missing in the client bundle.");
    throw new Error("GEMINI_API_KEY is missing. You must redeploy your app after setting the environment variable.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
Analyze the following text (Chapter ${chapterNumber}).
Generate a short, meaningful title (max 6 words).
Generate a concise summary (5-10 lines).

Text:
${content.substring(0, 10000)}
  `.trim();

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING }
            },
            required: ["title", "summary"]
          }
        }
      });

      if (response.text) {
        return JSON.parse(response.text) as { title: string; summary: string };
      }
      throw new Error("No response generated.");
    } catch (error: any) {
      console.error(`Attempt ${attempt + 1} failed for chapter ${chapterNumber}:`, error);
      if (attempt === retries - 1) {
        throw error;
      }
      // Exponential backoff: 2s, 4s, 8s...
      const delay = Math.pow(2, attempt) * 2000;
      console.log(`Retrying chapter ${chapterNumber} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Failed to generate metadata after multiple attempts.");
}

export async function generateChatResponse(
  query: string, 
  chapterContent: string, 
  history: ChatMessage[]
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
    throw new Error("GEMINI_API_KEY is missing. You must redeploy your app after setting the environment variable.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
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

  const prompt = `
Chapter Content:
${chapterContent}

Chat History:
${formattedHistory}

User Query: ${query}
  `.trim();

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          response: { type: Type.STRING },
          followUpQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          relationshipGraph: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING },
                target: { type: Type.STRING },
                relation: { type: Type.STRING }
              },
              required: ["source", "target", "relation"]
            } 
          }
        },
        required: ["response", "followUpQuestions", "relationshipGraph"]
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text) as {
      response: string;
      followUpQuestions: string[];
      relationshipGraph: { source: string; target: string; relation: string }[];
    };
  }
  throw new Error("No response generated.");
}
