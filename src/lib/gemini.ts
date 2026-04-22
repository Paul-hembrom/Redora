import { ChatMessage, ReadingPersona } from '../types';

export class ApiRateLimitError extends Error {
  public retryAfterMs: number;
  constructor(message: string, retryAfterMs: number) {
    super(`Rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1000)} seconds before trying again.`);
    this.name = 'ApiRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

function cleanErrorMessage(error: any): string {
  return error?.message || 'An unknown error occurred.';
}

async function callNvidiaFallback(prompt: string, systemInstruction?: string) {
  const apiKey = import.meta.env.VITE_NVIDIA_API_KEY;
  if (!apiKey) throw new Error("VITE_NVIDIA_API_KEY is missing. Please set it in your environment variables / Vercel settings.");

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
      model: "meta/llama-3.2-90b-vision-instruct",
      messages: messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterStr = response.headers.get('Retry-After');
      let retryDelayMs = 5000; // default 5 seconds
      if (retryAfterStr) {
        const parsed = parseInt(retryAfterStr, 10);
        if (!isNaN(parsed)) {
          retryDelayMs = parsed * 1000;
        } else {
          // It might be a date string
          const date = new Date(retryAfterStr);
          if (!isNaN(date.getTime())) {
            retryDelayMs = Math.max(date.getTime() - Date.now(), 5000);
          }
        }
      }
      throw new ApiRateLimitError(`NVIDIA API Rate Limit Exceeded`, retryDelayMs);
    }
    const err = await response.text();
    throw new Error(`NVIDIA API Error: ${err}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content;
  content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
  return content;
}

async function callNvidiaVisionFallback(base64Data: string, mimeType: string, prompt: string) {
  const apiKey = import.meta.env.VITE_NVIDIA_API_KEY;
  if (!apiKey) throw new Error("VITE_NVIDIA_API_KEY is missing. Please set it in your environment variables.");

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: prompt
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${base64Data}`
          }
        }
      ]
    }
  ];

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "meta/llama-3.2-90b-vision-instruct",
      messages: messages,
      temperature: 0.2,
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterStr = response.headers.get('Retry-After');
      let retryDelayMs = 5000; // default 5 seconds
      if (retryAfterStr) {
        const parsed = parseInt(retryAfterStr, 10);
        if (!isNaN(parsed)) {
          retryDelayMs = parsed * 1000;
        } else {
          const date = new Date(retryAfterStr);
          if (!isNaN(date.getTime())) {
            retryDelayMs = Math.max(date.getTime() - Date.now(), 5000);
          }
        }
      }
      throw new ApiRateLimitError(`NVIDIA Vision API Rate Limit Exceeded`, retryDelayMs);
    }
    const err = await response.text();
    throw new Error(`NVIDIA Vision API Error: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function generateChapterMetadata(content: string, chapterNumber: number, retries = 3): Promise<{title: string, summary: string}> {
  const prompt = `
Analyze the following text (Chapter ${chapterNumber}).
Generate a short, meaningful title (max 6 words).
Provide a highly accurate and concise summary (3-5 bullet points) that captures the main points and core arguments effectively.

Text:
${content.substring(0, 10000)}

IMPORTANT: You must return ONLY a valid JSON object with 'title' and 'summary' keys. No markdown formatting, no explanation.
  `.trim();

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const nvidiaResponse = await callNvidiaFallback(prompt);
      return JSON.parse(nvidiaResponse) as { title: string; summary: string };
    } catch (error: any) {
      console.error(`Attempt ${attempt + 1} failed for chapter ${chapterNumber}:`, error);
      if (attempt === retries - 1) {
        if (error instanceof ApiRateLimitError) throw error;
        throw new Error(cleanErrorMessage(error));
      }
      
      let delay = Math.pow(2, attempt) * 2000;
      if (error instanceof ApiRateLimitError) {
        delay = Math.max(delay, error.retryAfterMs);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Failed to generate metadata after multiple attempts.");
}

export async function extractTextFromImage(base64Data: string, mimeType: string): Promise<string> {
  const prompt = "Extract all text from this image. Return only the extracted text, preserving formatting where possible. If there is no text, return an empty string.";

  try {
    return await callNvidiaVisionFallback(base64Data, mimeType, prompt);
  } catch (error: any) {
    if (error instanceof ApiRateLimitError) throw error;
    throw new Error(cleanErrorMessage(error));
  }
}

export async function generateChatResponse(
  query: string, 
  chapterContent: string, 
  history: ChatMessage[],
  persona: ReadingPersona = 'general'
) {
  let personaInstruction = "You are an AI Book Reader assistant.";
  if (persona === 'student') {
    personaInstruction = "You are a patient, brilliant tutor. Explain concepts to a student using simple language, clear analogies, and focus on fundamental understanding.";
  } else if (persona === 'academic') {
    personaInstruction = "You are an academic researcher. Discuss this chapter with rigorous language, focusing on underlying theories, logic, methodological strengths/flaws, and broader implications.";
  } else if (persona === 'professional') {
    personaInstruction = "You are an executive assistant. Give a pragmatic executive briefing. Focus solely on action items, core arguments, and real-world takeaways without any fluff.";
  }

  const systemInstruction = `
${personaInstruction}
You are currently helping the user understand provided text, which could be a single chapter or multiple documents.
Answer the user's queries based ONLY on the provided content. If comparing multiple documents, synthesize and cite them.
Maintain conversational memory for follow-up questions.

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
Provided Content:
${chapterContent}

Chat History:
${formattedHistory}

User Query: ${query}

IMPORTANT: You must return ONLY a valid JSON object with 'response', 'followUpQuestions' (array of strings), and 'relationshipGraph' (array of objects with source, target, relation) keys. No markdown formatting, no explanation.
  `.trim();

  try {
    const nvidiaResponse = await callNvidiaFallback(prompt, systemInstruction);
    return JSON.parse(nvidiaResponse) as {
      response: string;
      followUpQuestions: string[];
      relationshipGraph: { source: string; target: string; relation: string }[];
    };
  } catch (error: any) {
    if (error instanceof ApiRateLimitError) throw error;
    throw new Error(cleanErrorMessage(error));
  }
}

export async function generateActionTool(chapterContent: string, toolType: 'quiz' | 'glossary' | 'brief') {
  let promptText = "";
  let jsonFormatInstructions = "";

  if (toolType === 'quiz') {
    promptText = "Generate a multiple-choice quiz based on the core concepts of this chapter to test understanding.";
    jsonFormatInstructions = "{ 'questions': [{ 'question': '...','options': ['A','B','C','D'], 'answerIndex': 0, 'explanation': '...' }] }";
  } else if (toolType === 'glossary') {
    promptText = "Extract the most important specialized terms or complex concepts from this chapter and provide clear definitions.";
    jsonFormatInstructions = "{ 'terms': [{ 'term': '...', 'definition': '...' }] }";
  } else if (toolType === 'brief') {
    promptText = "Generate an executive briefing from this chapter. It must include action items, key arguments, and a short memo-style summary.";
    jsonFormatInstructions = "{ 'summaryMemo': '...', 'actionItems': ['...'], 'keyArguments': ['...'] }";
  }

  const prompt = `
Task: ${promptText}

Chapter Content:
${chapterContent.substring(0, 50000)} // Ensure within limits

IMPORTANT: You must return ONLY a valid JSON object exactly matching this structure: ${jsonFormatInstructions}. No markdown formatting, no explanation.
  `.trim();

  try {
    const nvidiaResponse = await callNvidiaFallback(prompt);
    return JSON.parse(nvidiaResponse);
  } catch (error: any) {
    if (error instanceof ApiRateLimitError) throw error;
    throw new Error(cleanErrorMessage(error));
  }
}
