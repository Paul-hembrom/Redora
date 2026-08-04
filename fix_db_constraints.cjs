const fs = require('fs');
let code = fs.readFileSync('server/db.ts', 'utf-8');

const target = `    await sql\`
      // Clean up duplicates and add unique constraints
      try {
        await sql\\\`DELETE FROM visual_metadata a USING visual_metadata b WHERE a.ctid < b.ctid AND a.scene_id = b.scene_id\\\`;
        await sql\\\`DELETE FROM narration_assets a USING narration_assets b WHERE a.ctid < b.ctid AND a.scene_id = b.scene_id\\\`;
        await sql\\\`ALTER TABLE visual_metadata ADD CONSTRAINT visual_metadata_scene_uniq UNIQUE (scene_id)\\\`;
      } catch (e) {}
      try {
        await sql\\\`ALTER TABLE narration_assets ADD CONSTRAINT narration_assets_scene_uniq UNIQUE (scene_id)\\\`;
      } catch(e) {}
      
      CREATE TABLE IF NOT EXISTS visual_metadata (`.replace(/\\\\/g, ''); // the template literal was unescaped when reading in thought

// We can just use string replace. Wait, let me replace it safely.
