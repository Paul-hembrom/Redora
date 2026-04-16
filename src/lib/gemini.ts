import { GoogleGenAI, Type } from '@google/genai';
import { ChatMessage } from '../types';

function isRateLimitError(error: any): boolean {
  const msg = error?.message?.toLowerCase() || '';
  return msg.includes('429') || msg.includes('quota') || msg.includes('exhausted') || msg.includes('rate limit');
}

async function callNvidiaFallback(prompt: string, systemInstruction?: string) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY is missing for fallback.");

  const messages = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "mistralai/mistral-large-3-675b-instruct-2512",
      messages: messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`NVIDIA API Error: ${err}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content;
  content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
  return content;
}

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
Provide a highly accurate and concise summary (3-5 bullet points) that captures the main points and core arguments effectively.

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
      if (isRateLimitError(error) && process.env.NVIDIA_API_KEY) {
        console.log("Gemini rate limit exceeded, falling back to NVIDIA Mistral...");
        try {
          const nvidiaPrompt = prompt + "\n\nIMPORTANT: You must return ONLY a valid JSON object with 'title' and 'summary' keys. No markdown formatting, no explanation.";
          const nvidiaResponse = await callNvidiaFallback(nvidiaPrompt);
          return JSON.parse(nvidiaResponse) as { title: string; summary: string };
        } catch (nvidiaError) {
          console.error("NVIDIA fallback also failed:", nvidiaError);
          throw nvidiaError;
        }
      }

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

export async function extractTextFromImage(base64Data: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null' || apiKey === '') {
    throw new Error("GEMINI_API_KEY is missing. You must redeploy your app after setting the environment variable.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = "Extract all text from this image. Return only the extracted text, preserving formatting where possible. If there is no text, return an empty string.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    if (response.text) {
      return response.text;
    }
    throw new Error("No text extracted from image.");
  } catch (error: any) {
    if (isRateLimitError(error) && process.env.NVIDIA_API_KEY) {
      console.log("Gemini rate limit exceeded. NVIDIA fallback model (Mistral Large 3) does not support vision.");
      throw new Error("Gemini rate limit exceeded. The NVIDIA fallback model does not support image extraction.");
    }
    throw error;
  }
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

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
  } catch (error: any) {
    if (isRateLimitError(error) && process.env.NVIDIA_API_KEY) {
      console.log("Gemini rate limit exceeded, falling back to NVIDIA Mistral...");
      const nvidiaPrompt = prompt + "\n\nIMPORTANT: You must return ONLY a valid JSON object with 'response', 'followUpQuestions' (array of strings), and 'relationshipGraph' (array of objects with source, target, relation) keys. No markdown formatting, no explanation.";
      const nvidiaResponse = await callNvidiaFallback(nvidiaPrompt, systemInstruction);
      return JSON.parse(nvidiaResponse) as {
        response: string;
        followUpQuestions: string[];
        relationshipGraph: { source: string; target: string; relation: string }[];
      };
    }
    throw error;
  }
}
