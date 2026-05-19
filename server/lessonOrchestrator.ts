import sql from "./db.js";
import { synthesizeSpeech } from "./synthesizeSpeech.js";
import { v4 as uuidv4 } from "uuid";

export async function createInteractiveLesson(topicId: string, orgId: string) {
  // Try to find an existing storyboard for this topic/chapter
  const storyboards = await sql`
    SELECT id FROM storyboards 
    WHERE chapter_id = ${topicId} 
    ORDER BY created_at DESC 
    LIMIT 1
  `;

  let steps = [];

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
          audioUrl: scene.narration_url || null,
          duration: scene.estimated_duration_seconds || 15
        });
      } else if (scene.image_url) {
        steps.push({
          id: scene.id || uuidv4(),
          type: 'image',
          url: scene.image_url,
          caption: scene.narration || scene.visual_prompt || '',
          narrationText: scene.narration || '',
          audioUrl: scene.narration_url || null,
          duration: scene.estimated_duration_seconds || 10
        });
      }

      // Automatically synthesize speech if missing
      const lastStep = steps[steps.length - 1];
      if (lastStep && lastStep.narrationText && !lastStep.audioUrl) {
        try {
          // Wrap with simple emotive tags
          const textToSpeak = "[enthusiastic] " + lastStep.narrationText;
          const url = await synthesizeSpeech(textToSpeak);
          lastStep.audioUrl = url;
          // Optimistically cache it in DB for future plays
          if (scene.id) {
            await sql`INSERT INTO narration_assets (id, org_id, scene_id, asset_url, voice_name, duration_ms) 
                      VALUES (${uuidv4()}, ${orgId}, ${scene.id}, ${url}, 'Kore', 10000)`;
          }
        } catch (e) {
          console.error("TTS generation failed:", e);
        }
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
    const introText = "[enthusiastic] Welcome to today's lesson on " + chapter.title + ". [pause] " + chapter.summary;
    let audioUrl1 = null;
    try {
      audioUrl1 = await synthesizeSpeech(introText);
    } catch(e) {}
    
    steps.push({
      id: step1Id,
      type: 'image',
      caption: chapter.title,
      narrationText: introText,
      audioUrl: audioUrl1,
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

  return steps;
}
