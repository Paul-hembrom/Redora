import sql from "./db.js";
import { synthesizeElevenLabsSpeech, callLLM } from "../src/lib/gemini.js";
import { v4 as uuidv4 } from "uuid";
import { getStudentMemory } from "./studentMemory.js";

export async function createInteractiveLesson(topicId: string, orgId: string, userId: string = 'default', providedTitle?: string, providedContent?: string) {
  let steps: any[] = [];
  let memoryContext = '';

  if (topicId.startsWith('topic_curr_') || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(topicId)) {
    const title = providedTitle || "New Topic";
    const content = providedContent || "";
    
    steps.push({
      id: uuidv4(),
      type: 'intro',
      caption: title,
      narrationText: "Welcome to today's lesson on " + title + ". Let's dive right in!",
      narration_audio_url: null,
      emotion: 'smiling',
      duration: 5
    });

    steps.push({
      id: uuidv4(),
      type: 'image',
      caption: title + " Overview",
      narrationText: "Here's the main idea: " + content.substring(0, 200) + "...",
      narration_audio_url: null,
      emotion: 'neutral',
      duration: 15
    });

    steps.push({
      id: uuidv4(),
      type: 'question',
      text: "Based on what we just reviewed, what do you think is the most important concept in " + title + "?"
    });
  } else {
    // Check if topicId is a sub-topic (has a parent_id)
    const chaptersInfo = await sql`SELECT id, parent_id, title, summary, content FROM chapters WHERE id = ${topicId}`;
    
    if (chaptersInfo.length === 0) return [];
    
    const targetChapter = chaptersInfo[0];
    const lookupChapterId = targetChapter.parent_id || targetChapter.id;

    // Fetch memory
    memoryContext = await getStudentMemory(userId, lookupChapterId);

    // Try to find an existing storyboard for this topic/chapter
    const storyboards = await sql`
      SELECT id FROM storyboards 
      WHERE chapter_id = ${lookupChapterId} AND status = 'completed'
      ORDER BY created_at DESC 
      LIMIT 1
    `;

    // 1. We already fetched the topic content above
    const chapters = chaptersInfo;
    
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
          const isVideo = scene.model_used?.startsWith('veo') || scene.image_url.endsWith('.mp4');
          steps.push({
            id: scene.id || uuidv4(),
            type: isVideo ? 'video' : 'image',
            url: scene.image_url,
            caption: scene.narration || scene.visual_prompt || '',
            narrationText: scene.narration || '',
            narration_audio_url: scene.narration_url || null,
            duration: scene.estimated_duration_seconds || 10
          });
        }
      }
    }

    // If no storyboard exists, construct a simple lesson from the chapter text.
    if (steps.length === 0 && chapters.length > 0) {
      const chapter = chapters[0];
      
      // First step: Short Intro
      steps.push({
        id: uuidv4(),
        type: 'intro',
        caption: chapter.title,
        narrationText: "Welcome to today's lesson on " + chapter.title + ". Let's dive right in!",
        narration_audio_url: null,
        emotion: 'smiling',
        duration: 5
      });

      // Content step (shortened instead of dump)
      steps.push({
        id: uuidv4(),
        type: 'image',
        caption: chapter.title + " Overview",
        narrationText: "Here's the main idea: " + (chapter.summary || chapter.content || '').substring(0, 200) + "...",
        narration_audio_url: null,
        emotion: 'neutral',
        duration: 15
      });

      // Question
      steps.push({
        id: uuidv4(),
        type: 'question',
        text: "Based on what we just reviewed, what do you think is the most important concept in " + chapter.title + "?"
      });
    } else if (chapters.length > 0) {
       // Prepend Intro if not present, and append a question
       const chapter = chapters[0];
       steps.unshift({
          id: uuidv4(),
          type: 'intro',
          caption: chapter.title,
          narrationText: "Welcome to today's lesson! We'll be looking at " + chapter.title + ". Let's get started.",
          emotion: 'smiling'
       });

       steps.push({
        id: uuidv4(),
        type: 'question',
        text: "Let's pause here. Do you have any questions before we continue?"
      });
    }
  }

  // Now, rewrite narration using LLM for Maya persona
  if (steps.length > 0) {
     const prompt = `You are "Maya", a warm, witty, and encouraging teacher. Your goal is to make this lesson highly engaging, just like VideoTutor.io.
Your personality rules:
- Warm and friendly, like a favorite teacher.
- Humor: Sprinkle in some light, topic-relevant jokes or puns to keep attention.
- Encouraging: Praise the student or reassure them when asking questions.
- Tone: Conversational, interactive, and natural. Do NOT dump walls of text. Keep each narration segment concise and engaging.
- Use explicit audio emotion tags for the TTS engine. Available tags: [smiling], [excited], [curious], [neutral], [thinking]. Use them at the START of sentences to set the tone. 
- For jokes, add a [short pause] before the punchline if it fits.
${memoryContext ? `\nVERY IMPORTANT - STUDENT MEMORY:\nHere is what you remember from previous sessions with this student:\n"${memoryContext}"\nUse this context subtly to personalize this lesson. Do it right at the start and in how you scale explanations.` : ''}

Here is the current draft of the lesson steps:
${JSON.stringify(steps.map(s => ({ id: s.id, type: s.type, narrationText: s.narrationText, text: s.text })))}

Task:
1. Rewrite 'narrationText' for every step (except 'question' steps use 'text' as their display, so rewrite the narrationText you will say). 
2. If a step is 'question', provide a 'narrationText' that Maya speaks to ask the question.
3. Ensure the first 'intro' step is extremely welcoming ("Hello! I'm Maya...").
4. Return an updated array of objects.

For each step in the input, return exactly ONE object with:
- id: string
- narrationText: string
- emotion: string (one of 'neutral', 'smiling', 'thinking', 'excited', 'curious')
- type: string (you may optionally change an 'image' step to 'joke' or 'fun_fact' if you are inserting pure humor here, otherwise keep original)
- humor: an object ({"setup": string, "punchline": string}) if this step contains a distinct joke, otherwise null.

Respond with valid json only, matching exactly this shape (no markdown, no commentary, no code fences):
{"steps": [{"id": "string", "narrationText": "string", "emotion": "string", "type": "string", "humor": null}]}`;

     try {
       const systemInstruction = "You output only valid json matching the shape the user requests. Never include markdown formatting or commentary outside the json object.";
       const raw = await callLLM(prompt, systemInstruction, 'json_object', 8192);
       
       const parsed = raw ? JSON.parse(raw) : { steps: [] };
       const parsedParts = Array.isArray(parsed) ? parsed : (parsed.steps || []);

       for (const part of parsedParts) {
         const match = steps.find(s => s.id === part.id);
         if (match) {
           match.narrationText = part.narrationText;
           if (part.emotion) match.emotion = part.emotion;
           if (part.type) match.type = part.type;
           match.humor = part.humor || null;
         }
       }
     } catch(e) {
       console.warn("Maya personality enrichment failed, using raw steps", e.message || e);
     }
  }

  // Synthesize speech for every step that has narration
  for (const step of steps) {
    if (step.narrationText) {
      try {
        let ttsText = step.narrationText;
        if (step.humor) {
          // If we have distinct humor setup/punchline, ensure it's spoken
          if (!ttsText.includes(step.humor.setup)) {
            ttsText = `${ttsText}. ${step.humor.setup} [short pause] ${step.humor.punchline}`;
          }
        }
        
        // Ensure an emotion tag exists at the start for Kore TTS if it supports it
        let em = step.emotion || 'neutral';
        if (em === 'excited') em = 'enthusiastic';
        if (!ttsText.startsWith('[')) {
          ttsText = `[${em}] ${ttsText}`;
        }
        
        
        const result = await synthesizeElevenLabsSpeech(ttsText);
        if (typeof result === 'string') {
          step.narration_audio_url = result || null;
        } else if (Array.isArray(result) && result.length > 0) {
          step.narration_audio_chunks = result;
          step.narration_audio_url = result[0].audioUrl; // fallback
        } else {
          step.narration_audio_url = null;
        }

      } catch(e) {
         console.error("TTS generation failed for step:", step.id, e);
         // Fallback to a tiny silent WAV data URI so the frontend logic can proceed
         step.narration_audio_url = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      }
    }
  }

  return steps;
}