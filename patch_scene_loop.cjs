const fs = require('fs');
let code = fs.readFileSync('server/videoPipeline.ts', 'utf-8');

const loopTarget = `    for (let i = 0; i < scenesData.length; i++) {
      const sc = scenesData[i];
      const sceneId = uuidv4();
      const visualPrompt = typeof sc.visual === 'string' ? sc.visual : (sc.visual?.prompt || '');
      const duration = Math.max(5, Math.ceil(sc.narration.length / 15));`;

const loopReplace = `    for (let i = 0; i < scenesData.length; i++) {
      const sc = scenesData[i];
      const sceneId = uuidv4();
      const visualPrompt = typeof sc.visual === 'string' ? sc.visual : (sc.visual?.prompt || '');
      
      const narration = (sc.narration || '').trim();
      if (!narration) {
        console.warn('[Pro] Skipping scene with no narration:', sc.title);
        continue;
      }
      const duration = Math.max(5, Math.ceil(narration.length / 15));`;

code = code.replace(loopTarget, loopReplace);

// Also we need to use `narration` variable instead of `sc.narration` for the insert
code = code.replace(
  'VALUES (${sceneId}, ${sbId}, ${org_id}, ${i}, ${sc.narration}, ${visualPrompt}, ${duration})',
  'VALUES (${sceneId}, ${sbId}, ${org_id}, ${i}, ${narration}, ${visualPrompt}, ${duration})'
);

fs.writeFileSync('server/videoPipeline.ts', code);
