const fs = require('fs');
let code = fs.readFileSync('server/videoPipeline.ts', 'utf-8');

const target1 = `    await sql\`
    INSERT INTO visual_metadata (id, org_id, scene_id, image_url, prompt, model_used)
    VALUES (\${uuidv4()}, \${org_id}, \${scene_id}, \${image_url}, \${visual_prompt}, \${model_used})
    ON CONFLICT DO NOTHING
  \`;`;

const replace1 = `    await sql\`
    INSERT INTO visual_metadata (id, org_id, scene_id, image_url, prompt, model_used)
    VALUES (\${uuidv4()}, \${org_id}, \${scene_id}, \${image_url}, \${visual_prompt}, \${model_used})
    ON CONFLICT (scene_id) DO UPDATE
      SET image_url = EXCLUDED.image_url,
          model_used = EXCLUDED.model_used,
          prompt = EXCLUDED.prompt
  \`;`;

code = code.replace(target1, replace1);

const target2 = `    if (audioUrl) {
      await sql\`
        INSERT INTO narration_assets (id, org_id, scene_id, asset_url, voice_name, duration_ms)
        VALUES (\${uuidv4()}, \${org_id}, \${scene_id}, \${audioUrl}, \${voiceName}, \${duration * 1000})
        ON CONFLICT DO NOTHING
      \`;
    }`;

const replace2 = `    if (audioUrl) {
      await sql\`
        INSERT INTO narration_assets (id, org_id, scene_id, asset_url, voice_name, duration_ms)
        VALUES (\${uuidv4()}, \${org_id}, \${scene_id}, \${audioUrl}, \${voiceName}, \${duration * 1000})
        ON CONFLICT (scene_id) DO UPDATE
          SET asset_url = EXCLUDED.asset_url,
              voice_name = EXCLUDED.voice_name,
              duration_ms = EXCLUDED.duration_ms
      \`;
    }`;

code = code.replace(target2, replace2);
fs.writeFileSync('server/videoPipeline.ts', code);
