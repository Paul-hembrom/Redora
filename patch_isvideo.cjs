const fs = require('fs');
let code = fs.readFileSync('server/lessonOrchestrator.ts', 'utf-8');

// Replace isVideo logic
const targetVideo = `const isVideo = scene.model_used?.startsWith('veo') || scene.image_url.endsWith('.mp4');`;
const replaceVideo = `const isVideo =
            scene.model_used === 'manim' ||
            scene.model_used?.startsWith('veo') ||
            /\\.(mp4|webm|mov)(\\?|#|$)/i.test(scene.image_url || '');`;

code = code.replace(targetVideo, replaceVideo);

// Check if scene.video_url branch exists
const targetDead = `        if (scene.video_url) {
          steps.push({
            id: scene.id || uuidv4(),
            type: 'video',
            url: scene.video_url,
            caption: scene.narration || scene.visual_prompt || '',
            narrationText: scene.narration || '',
            narration_audio_url: scene.narration_url || null,
            duration: scene.estimated_duration_seconds || 15
          });
        } else if (scene.image_url) {`;

const replaceDead = `        if (scene.image_url) {`;

if (code.includes('if (scene.video_url) {')) {
  code = code.replace(targetDead, replaceDead);
}

fs.writeFileSync('server/lessonOrchestrator.ts', code);
