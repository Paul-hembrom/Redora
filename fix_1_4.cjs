require('dotenv').config();
const postgres = require('postgres');

async function main() {
  const sql = postgres(process.env.DATABASE_URL);
  
  await sql`
    DELETE FROM visual_metadata a USING visual_metadata b
      WHERE a.ctid < b.ctid AND a.scene_id = b.scene_id;
  `;
  await sql`
    DELETE FROM narration_assets a USING narration_assets b
      WHERE a.ctid < b.ctid AND a.scene_id = b.scene_id;
  `;

  await sql`ALTER TABLE visual_metadata ADD CONSTRAINT visual_metadata_scene_uniq UNIQUE (scene_id);`.catch(() => {});
  await sql`ALTER TABLE narration_assets ADD CONSTRAINT narration_assets_scene_uniq UNIQUE (scene_id);`.catch(() => {});

  console.log('Done 1.4 schema');
  process.exit(0);
}
main().catch(console.error);
