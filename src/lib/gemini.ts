import { GoogleGenAI, Type } from '@google/genai';
import { ChatMessage, ReadingPersona } from '../types';

function isRateLimitError(error: any): boolean {
  const msg = error?.message?.toLowerCase() || '';
  return msg.includes('429') || msg.includes('quota') || msg.includes('exhausted') || msg.includes('rate limit');
}

function cleanErrorMessage(error: any): string {
  if (isRateLimitError(error)) {
    return "The AI provider's rate limit has been exceeded. Please wait a minute and try again.";
  }
  return error?.message || 'An unknown error occurred.';
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
      model: "meta/llama-3.2-90b-vision-instruct",
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

async function callNvidiaVisionFallback(base64Data: string, mimeType: string, prompt: string) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY is missing for fallback.");

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
    const err = await response.text();
    throw new Error(`NVIDIA Vision API Error: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
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
          throw new Error(cleanErrorMessage(error));
        }
      }

      console.error(`Attempt ${attempt + 1} failed for chapter ${chapterNumber}:`, error);
      if (attempt === retries - 1) {
        throw new Error(cleanErrorMessage(error));
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
      console.log("Gemini rate limit exceeded. Falling back to NVIDIA Gemma 3 27B IT for image extraction...");
      try {
        return await callNvidiaVisionFallback(base64Data, mimeType, prompt);
      } catch (nvidiaError) {
        throw new Error(cleanErrorMessage(error));
      }
    }
    throw new Error(cleanErrorMessage(error));
  }
}

export async function generateChatResponse(
  query: string, 
  chapterContent: string, 
  history: ChatMessage[],
  persona: ReadingPersona = 'general'
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
    throw new Error("GEMINI_API_KEY is missing. You must redeploy your app after setting the environment variable.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
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
      try {
        const nvidiaPrompt = prompt + "\n\nIMPORTANT: You must return ONLY a valid JSON object with 'response', 'followUpQuestions' (array of strings), and 'relationshipGraph' (array of objects with source, target, relation) keys. No markdown formatting, no explanation.";
        const nvidiaResponse = await callNvidiaFallback(nvidiaPrompt, systemInstruction);
        return JSON.parse(nvidiaResponse) as {
          response: string;
          followUpQuestions: string[];
          relationshipGraph: { source: string; target: string; relation: string }[];
        };
      } catch (nvidiaErr) {
        throw new Error(cleanErrorMessage(error));
      }
    }
    throw new Error(cleanErrorMessage(error));
  }
}

export async function generateActionTool(chapterContent: string, toolType: 'quiz' | 'glossary' | 'brief') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
    throw new Error("GEMINI_API_KEY is missing. You must redeploy your app after setting the environment variable.");
  }
  const ai = new GoogleGenAI({ apiKey });

  let schema: any;
  let promptText = "";

  if (toolType === 'quiz') {
    promptText = "Generate a multiple-choice quiz based on the core concepts of this chapter to test understanding.";
    schema = {
      type: Type.OBJECT,
      properties: {
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              answerIndex: { type: Type.INTEGER, description: "0-based index of the correct option" },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "answerIndex", "explanation"]
          }
        }
      },
      required: ["questions"]
    };
  } else if (toolType === 'glossary') {
    promptText = "Extract the most important specialized terms or complex concepts from this chapter and provide clear definitions.";
    schema = {
      type: Type.OBJECT,
      properties: {
        terms: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              definition: { type: Type.STRING }
            },
            required: ["term", "definition"]
          }
        }
      },
      required: ["terms"]
    };
  } else if (toolType === 'brief') {
    promptText = "Generate an executive briefing from this chapter. It must include action items, key arguments, and a short memo-style summary.";
    schema = {
      type: Type.OBJECT,
      properties: {
        summaryMemo: { type: Type.STRING },
        actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
        keyArguments: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["summaryMemo", "actionItems", "keyArguments"]
    };
  }

  const prompt = `
Task: ${promptText}

Chapter Content:
${chapterContent.substring(0, 50000)} // Ensure within limits
  `.trim();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    });

    if (response.text) return JSON.parse(response.text);
    throw new Error("No response generated.");
  } catch (error: any) {
    if (isRateLimitError(error) && process.env.NVIDIA_API_KEY) {
      console.log(`Gemini rate limit exceeded for ${toolType}, falling back to NVIDIA Mistral...`);
      try {
        let jsonFormatInstructions = "";
        if (toolType === 'quiz') jsonFormatInstructions = "{ 'questions': [{ 'question': '...','options': ['A','B','C','D'], 'answerIndex': 0, 'explanation': '...' }] }";
        if (toolType === 'glossary') jsonFormatInstructions = "{ 'terms': [{ 'term': '...', 'definition': '...' }] }";
        if (toolType === 'brief') jsonFormatInstructions = "{ 'summaryMemo': '...', 'actionItems': ['...'], 'keyArguments': ['...'] }";
        
        const nvidiaPrompt = prompt + `\n\nIMPORTANT: You must return ONLY a valid JSON object exactly matching this structure: ${jsonFormatInstructions}. No markdown formatting, no explanation.`;
        const nvidiaResponse = await callNvidiaFallback(nvidiaPrompt);
        return JSON.parse(nvidiaResponse);
      } catch (nvidiaErr) {
        throw new Error(cleanErrorMessage(error));
      }
    }
    throw new Error(cleanErrorMessage(error));
  }
}
