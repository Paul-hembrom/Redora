require('dotenv').config();
const postgres = require('postgres');

async function main() {
  const sql = postgres(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_name IN ('scenes', 'visual_metadata', 'narration_assets', 'storyboards', 'generation_jobs', 'chapters', 'chats')
    ORDER BY table_name, ordinal_position;
  `;
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
main().catch(console.error);
