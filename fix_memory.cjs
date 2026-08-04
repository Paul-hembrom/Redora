require('dotenv').config();
const postgres = require('postgres');
async function main() {
  const sql = postgres(process.env.DATABASE_URL);
  
  await sql`
    CREATE TABLE IF NOT EXISTS student_memory (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL,
      chapter_id TEXT,
      summary TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_student_memory_user ON student_memory(user_id, created_at DESC);`;
  
  await sql`
    INSERT INTO student_memory (id, user_id, chapter_id, summary, created_at)
    SELECT id::uuid, user_id, chapter_id, text, created_at
    FROM chats WHERE type = 'memory'
    ON CONFLICT DO NOTHING;
  `;
  await sql`DELETE FROM chats WHERE type = 'memory';`;
  console.log('Migrated memory');
  process.exit(0);
}
main().catch(console.error);
