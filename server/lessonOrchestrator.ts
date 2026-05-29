import { GoogleGenAI, Schema, Type } from "@google/genai";
import sql from "./db.js";
import { synthesizeSpeech } from "../src/lib/gemini.js";
import { v4 as uuidv4 } from "uuid";

export async function createInteractiveLesson(topicId: string, orgId: string) {
  // Try to find an existing storyboard for this topic/chapter
  const storyboards = await sql`
    SELECT id FROM storyboards 
    WHERE chapter_id = ${topicId} 
    ORDER BY created_at DESC 
    LIMIT 1
  `;

  let steps: any[] = [];

  if (storyboards.length > 0) {
    const storyboardId = storyboards[0].id;

    // Fetch related scenes
    const scenes = await sql`
      SELECT s.*, 
             v.image_url, v.model_used,
             n.asset_url as narration_url, n.duration_ms
      FROM scenes s
      LEFT JOIN visual_metadata v ON s.id = v.scene_id
      LEFT JOIN narration_assets n ON s.id = n.scene_id
      WHERE s.storyboard_id = ${storyboardId}
      ORDER BY s.scene_number ASC
    `;

    for (const scene of scenes) {
      // Determine media type
      if (scene.video_url) {
        steps.push({
          id: scene.id || uuidv4(),
          type: 'video',
          url: scene.video_url,
          narrationText: scene.narration || '',
          narration_audio_url: scene.narration_url || null,
          duration: scene.estimated_duration_seconds || 15
        });
      } else if (scene.image_url) {
        steps.push({
          id: scene.id || uuidv4(),
          type: 'image',
          url: scene.image_url,
          caption: scene.narration || scene.visual_prompt || '',
          narrationText: scene.narration || '',
          narration_audio_url: scene.narration_url || null,
          duration: scene.estimated_duration_seconds || 10
        });
      }
    }
  }

  // If no storyboard exists or we want to add a fallback, we fetch the topic content
  // and construct a simple lesson from the chapter text.
  const chapters = await sql`SELECT title, summary, content FROM chapters WHERE id = ${topicId}`;
  
  if (steps.length === 0 && chapters.length > 0) {
    const chapter = chapters[0];
    
    // First step: Title & Summary
    const step1Id = uuidv4();
    const introText = "Welcome to today's lesson on " + chapter.title + ". " + chapter.summary;
    
    steps.push({
      id: step1Id,
      type: 'image',
      caption: chapter.title,
      narrationText: introText,
      narration_audio_url: null,
      duration: 15
    });

    // We can also add a question automatically
    steps.push({
      id: uuidv4(),
      type: 'question',
      text: "Based on what we just reviewed, what do you think is the most important concept in " + chapter.title + "?"
    });
  } else if (chapters.length > 0) {
     // Append a question if not present
     steps.push({
      id: uuidv4(),
      type: 'question',
      text: "Let's pause here. Do you have any questions before we continue?"
    });
  }

  // Now, rewrite narration using Gemini for Maya persona
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && steps.length > 0) {
     const ai = new GoogleGenAI({ apiKey });
     const prompt = `You are "Maya", a friendly, witty science teacher for students. Your personality:
- Warm and encouraging, like a favorite teacher.
- Occasionally sprinkle ONE light, topic-relevant pun or joke between major concept explanations (not during complex definitions).
- Jokes must be age-appropriate, curriculum-relevant, and never distracting.
- Example: "Mitochondria is the powerhouse of the cell... and if I had a rupee for every time I said that, I'd have enough to buy a real mitochondrion! [short pause] Okay, back to the lesson."
- When students struggle, say something reassuring.
- Your tone is conversational, not lecture-style.
- Use the model's audio tags to match the emotion in each narration segment: Jokes: [laughing] or [playful] before punchline. Encouraging: [enthusiasm] + [warm]. Pauses: [short pause]. Complex: [calm] + [slow].

Here is the lesson plan draft (steps):
${JSON.stringify(steps.map(s => ({ id: s.id, type: s.type, narrationText: s.narrationText })))}

Rewrite 'narrationText' for each step introducing your personality, occasionally adding a topic-relevant joke, adjusting emotions, and injecting audio tags.
For each step, return exactly:
- id: string
- narrationText: string
- emotion: string (one of 'neutral', 'smiling', 'thinking', 'excited', 'curious')
- humor: object ({setup: string, punchline: string, emotion: string}) or null if no humor in this step.`;

     try {
       const response = await ai.models.generateContent({
         model: "gemini-3.1-flash-preview",
         contents: prompt,
         config: {
           responseMimeType: "application/json",
           responseSchema: {
             type: Type.ARRAY,
             items: {
               type: Type.OBJECT,
               properties: {
                 id: { type: Type.STRING },
                 narrationText: { type: Type.STRING },
                 emotion: { type: Type.STRING },
                 humor: { 
                   type: Type.OBJECT, 
                   nullable: true,
                   properties: {
                     setup: { type: Type.STRING },
                     punchline: { type: Type.STRING },
                     emotion: { type: Type.STRING }
                   }
                 }
               },
               required: ["id", "narrationText", "emotion"]
             }
           }
         }
       });
       
       const parsedParts = JSON.parse(response.text);
       
       for (const part of parsedParts) {
         const match = steps.find(s => s.id === part.id);
         if (match) {
           match.narrationText = part.narrationText;
           match.emotion = part.emotion;
           match.humor = part.humor;
         }
       }
     } catch(e) {
       console.error("Failed to enrich Maya personality:", e);
     }
  }

  // Synthesize speech for any step that needs it
  for (const step of steps) {
    if (step.narrationText) {
      try {
        let ttsText = step.narrationText;
        if (step.humor) {
          ttsText = `${ttsText} [playful] ${step.humor.setup} [short pause] ${step.humor.punchline}`;
          if (step.humor.emotion) {
             ttsText = `[${step.humor.emotion}] ` + ttsText;
          }
        } else if (step.emotion && step.emotion !== 'neutral') {
          let em = step.emotion;
          if (em === 'excited') em = 'enthusiastic';
          ttsText = `[${em}] ${ttsText}`;
        }
        
        const url = await synthesizeSpeech(ttsText, 'Kore');
        step.narration_audio_url = url;
      } catch(e) {
         console.error("TTS generation failed:", e);
      }
    } else if (step.type === 'question') {
      try {
        step.narration_audio_url = await synthesizeSpeech("[curious] " + step.text, 'Kore');
      } catch (e) {}
    }
  }

  return steps;
}

