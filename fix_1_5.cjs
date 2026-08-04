const fs = require('fs');

let vp = fs.readFileSync('server/videoPipeline.ts', 'utf-8');

const targetLoop = `    for (const sc of scenesData) {
      const sceneId = uuidv4();
      const visualPrompt = sc.visual?.prompt || sc.title;
      const duration = Math.max(5, Math.ceil(sc.narration.length / 15));
      const rendererKind = sc.visual?.kind || 'veo';
      await sql\`
        INSERT INTO scenes (id, storyboard_id, organization_id, scene_number, narration, visual_prompt, estimated_duration_seconds)
        VALUES (\${sceneId}, \${sbId}, \${org_id}, \${i}, \${sc.narration}, \${visualPrompt}, \${duration})
      \`;
      dbScenes.push({ id: sceneId, visual_prompt: visualPrompt, narration: sc.narration, duration, renderer: rendererKind });
      i++;
    }`;

const replacementLoop = `    for (const sc of scenesData) {
      const narration = (sc.narration || '').trim();
      if (!narration) {
        console.warn('[Pro] Skipping scene with no narration:', sc.title);
        continue;
      }
      const sceneId = uuidv4();
      const visualPrompt = sc.visual?.prompt || sc.title || 'educational illustration';
      const duration = Math.max(5, Math.ceil(narration.length / 15));
      const rendererKind = sc.visual?.kind || 'veo';
      await sql\`
        INSERT INTO scenes (id, storyboard_id, organization_id, scene_number, narration, visual_prompt, estimated_duration_seconds)
        VALUES (\${sceneId}, \${sbId}, \${org_id}, \${i}, \${narration}, \${visualPrompt}, \${duration})
      \`;
      dbScenes.push({ id: sceneId, visual_prompt: visualPrompt, narration, duration, renderer: rendererKind });
      i++;
    }`;

vp = vp.replace(targetLoop, replacementLoop);
fs.writeFileSync('server/videoPipeline.ts', vp);
