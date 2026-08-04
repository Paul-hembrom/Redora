const fs = require('fs');
let content = fs.readFileSync('server/lessonOrchestrator.ts', 'utf-8');

const targetStr = `      for (const scene of scenes) {
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
          const isVideo =
            scene.model_used === 'manim' ||
            scene.model_used?.startsWith('veo') ||
            /\\.(mp4|webm|mov)(\\?|#|$)/i.test(scene.image_url || '');
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
      }`;

const newTargetStr = `      for (const scene of scenes) {
        if (scene.image_url) {
          const isVideo =
            scene.model_used === 'manim' ||
            scene.model_used?.startsWith('veo') ||
            /\\.(mp4|webm|mov)(\\?|#|$)/i.test(scene.image_url || '');
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
      }`;

content = content.replace(targetStr, newTargetStr);
fs.writeFileSync('server/lessonOrchestrator.ts', content);
console.log("Fixed video url");
