const fs = require('fs');
let code = fs.readFileSync('server/db.ts', 'utf-8');

const oldStr = `    \`;
    await sql\`
      // Clean up duplicates and add unique constraints
      try {
        await sql\`DELETE FROM visual_metadata a USING visual_metadata b WHERE a.ctid < b.ctid AND a.scene_id = b.scene_id\`;
        await sql\`DELETE FROM narration_assets a USING narration_assets b WHERE a.ctid < b.ctid AND a.scene_id = b.scene_id\`;
        await sql\`ALTER TABLE visual_metadata ADD CONSTRAINT visual_metadata_scene_uniq UNIQUE (scene_id)\`;
      } catch (e) {}
      try {
        await sql\`ALTER TABLE narration_assets ADD CONSTRAINT narration_assets_scene_uniq UNIQUE (scene_id)\`;
      } catch(e) {}
      
      CREATE TABLE IF NOT EXISTS visual_metadata (`;
      
const matchIndex = code.indexOf('// Clean up duplicates');

if (matchIndex !== -1) {
    const start = code.lastIndexOf('await sql`', matchIndex);
    const end = code.indexOf('CREATE TABLE', matchIndex);
    
    if (start !== -1 && end !== -1) {
        const replace = `
    try {
      await sql\`DELETE FROM visual_metadata a USING visual_metadata b WHERE a.ctid < b.ctid AND a.scene_id = b.scene_id\`;
      await sql\`DELETE FROM narration_assets a USING narration_assets b WHERE a.ctid < b.ctid AND a.scene_id = b.scene_id\`;
      await sql\`ALTER TABLE visual_metadata ADD CONSTRAINT visual_metadata_scene_uniq UNIQUE (scene_id)\`;
    } catch (e) {}
    try {
      await sql\`ALTER TABLE narration_assets ADD CONSTRAINT narration_assets_scene_uniq UNIQUE (scene_id)\`;
    } catch(e) {}
    
    await sql\`
      `;
      code = code.substring(0, start) + replace + code.substring(end);
      fs.writeFileSync('server/db.ts', code);
    }
}
