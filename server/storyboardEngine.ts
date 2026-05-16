import { GoogleGenAI } from '@google/genai';
import sql from './db.js';
import { v4 as uuidv4 } from 'uuid';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function generateStoryboardJob(
  jobId: string,
  organization_id: string,
  document_id: string,
  chapter_id: string,
  title: string,
  summary: string,
  key_concepts: string,
  subject: string,
  grade_level: string,
  visual_style: string,
  narration_style: string
) {
  try {
    await sql`UPDATE storyboards SET status = 'generating', progress = 10 WHERE id = ${jobId}`;

    const prompt = `
You are an expert educational instructional designer and storyboard creator.
Your task is to take the following chapter information and generate a structured storyboard JSON.

Chapter Title: ${title}
Summary: ${summary}
Key Concepts: ${key_concepts}
Subject: ${subject}
Grade Level: ${grade_level}
Visual Style: ${visual_style}
Narration Style: ${narration_style}

Create a scene-by-scene storyboard. Note that this is for educational context.
The response MUST be valid JSON fitting this schema:
{
  "scenes": [
    {
      "scene_number": <number>,
      "narration": "<spoken text for this scene>",
      "animation_instructions": "<how things move/appear>",
      "camera_directions": "<camera movement, e.g., pan, zoom>",
      "labels": ["<label1>", "<label2>"],
      "transition_to_next": "<transition text>",
      "estimated_duration_seconds": <number>,
      "visual_prompt": "<detailed description of the visual scene suitable for an image/video generator>",
      "educational_metadata": { "concept_focus": "<concept>" }
    }
  ]
}
Return ONLY the raw JSON object. Do not include markdown formatting like \`\`\`json.
`;

    await sql`UPDATE storyboards SET progress = 30 WHERE id = ${jobId}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '';
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (err) {
      parsed = JSON.parse(responseText.replace(/\\n/g, '').replace(/\\r/g, '').trim());
    }

    if (!parsed || !parsed.scenes || !Array.isArray(parsed.scenes)) {
      throw new Error('Invalid JSON structure returned by AI');
    }

    await sql`UPDATE storyboards SET progress = 70 WHERE id = ${jobId}`;

    for (const scene of parsed.scenes) {
      const sceneId = uuidv4();
      await sql`
        INSERT INTO scenes (
          id, storyboard_id, organization_id, scene_number, narration, 
          animation_instructions, camera_directions, labels, transition_to_next, 
          estimated_duration_seconds, visual_prompt, educational_metadata
        ) VALUES (
          ${sceneId}, ${jobId}, ${organization_id}, ${scene.scene_number}, ${scene.narration},
          ${scene.animation_instructions}, ${scene.camera_directions}, ${JSON.stringify(scene.labels || [])},
          ${scene.transition_to_next}, ${scene.estimated_duration_seconds}, ${scene.visual_prompt},
          ${JSON.stringify(scene.educational_metadata || {})}
        )
      `;
    }

    await sql`UPDATE storyboards SET status = 'completed', progress = 100 WHERE id = ${jobId}`;

  } catch (error: any) {
    console.error('Storyboard generation error:', error);
    await sql`UPDATE storyboards SET status = 'failed', error = ${error.message || String(error)} WHERE id = ${jobId}`;
  }
}

export async function regenerateScene(scene_id: string) {
  try {
    const scenes = await sql`SELECT * FROM scenes WHERE id = ${scene_id}`;
    if (!scenes.length) throw new Error("Scene not found");
    const scene = scenes[0];

    const storyboards = await sql`SELECT * FROM storyboards WHERE id = ${scene.storyboard_id}`;
    if (!storyboards.length) throw new Error("Storyboard not found");
    const sb = storyboards[0];

    await sql`UPDATE scenes SET status = 'generating' WHERE id = ${scene_id}`;

    const prompt = `
You are an expert educational instructional designer.
We are regenerating Scene ${scene.scene_number} of a storyboard.

Chapter Title: ${sb.title}
Subject: ${sb.subject}
Grade Level: ${sb.grade_level}
Visual Style: ${sb.visual_style}
Narration Style: ${sb.narration_style}

Here is the current scene data:
Narration: ${scene.narration}
Animation: ${scene.animation_instructions}
Camera: ${scene.camera_directions}
Visual Prompt: ${scene.visual_prompt}

Please rewrite and improve this single scene to make it more engaging.
Return ONLY valid JSON matching this schema:
{
  "narration": "<spoken text>",
  "animation_instructions": "<animation>",
  "camera_directions": "<camera>",
  "labels": ["<label1>"],
  "transition_to_next": "<transition>",
  "estimated_duration_seconds": <number>,
  "visual_prompt": "<prompt>",
  "educational_metadata": { "concept_focus": "<concept>" }
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text || '{}');

    await sql`
      UPDATE scenes 
      SET 
        narration = ${parsed.narration || scene.narration},
        animation_instructions = ${parsed.animation_instructions || scene.animation_instructions},
        camera_directions = ${parsed.camera_directions || scene.camera_directions},
        labels = ${JSON.stringify(parsed.labels || [])},
        transition_to_next = ${parsed.transition_to_next || scene.transition_to_next},
        estimated_duration_seconds = ${parsed.estimated_duration_seconds || scene.estimated_duration_seconds},
        visual_prompt = ${parsed.visual_prompt || scene.visual_prompt},
        educational_metadata = ${JSON.stringify(parsed.educational_metadata || {})},
        status = 'completed',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${scene_id}
    `;

  } catch (error: any) {
    console.error('Scene regeneration error:', error);
    await sql`UPDATE scenes SET status = 'failed' WHERE id = ${scene_id}`;
    throw error;
  }
}
