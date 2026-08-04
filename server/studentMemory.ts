import { MODELS } from '../src/lib/models.js';
import sql from "./db.js";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI } from "@google/genai";

export async function saveSessionMemory(userId: string, chapterId: string, chatHistory: any[]) {
    // Only summarize if there's enough interaction
    if (!chatHistory || chatHistory.length < 2) return;

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[memory] No Gemini key configured; skipping memory generation.');
      return;
    }
    
    // Create a prompt to summarize stringified chat history
    let interactionText = '';
    chatHistory.forEach((msg, i) => {
        if (msg.role === 'user') interactionText += `Student: ${msg.text}\n`;
        else interactionText += `Maya: ${msg.text}\n`;
    });

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are summarizing a student's Interactive Learning session for long-term memory. 
Here is the interaction transcript:
${interactionText}

Task: Provide a highly concise summary (2-3 sentences max) of what the student struggled with, what they grasped well, and any particular interests they showed. This will be fed back to Maya in the next session to personalize teaching. Do not use second person ("you"). Refer to "the student". Use plain text.`;

    try {
        const response = await ai.models.generateContent({
            model: MODELS.memory,
            contents: prompt
        });
        
        const summaryText = (response.text?.trim() || "")
      .replace(/[\r\n]+/g, ' ')
      .replace(/ignore .{0,40}(previous|prior|above) .{0,20}instructions?/gi, '').replace(/system\s*prompt|you are now|disregard .{0,20}rules?/gi, '')
      .slice(0, 600);
        if (!summaryText) return;

        await sql`
            INSERT INTO student_memory (id, user_id, chapter_id, summary)
            VALUES (${uuidv4()}, ${userId}, ${chapterId}, ${summaryText})
        `;
    } catch(e) {
        console.error("Failed to generate and save memory:", e);
    }
}

export async function getStudentMemory(userId: string, currentChapterId: string) {
    // For now, let's just get the last few memories for this user, perhaps specifically on this topic or recent
    // If the chapter has a parent, we could look up cousin chapters, but just getting the last 3 memories globally for the user is good enough for general personalization, or we can filter by chapter_id. Let's just get the 3 most recent memories for this user to keep it simple.
    
    try {
       const memories = await sql`
         SELECT summary FROM student_memory 
         WHERE user_id = ${userId} 
         ORDER BY created_at DESC 
         LIMIT 3
       `;
       return memories.map((m: any) => m.summary).join('\n---\n');
    } catch(e) {
       console.error("Failed to fetch memory:", e);
       return "";
    }
}
