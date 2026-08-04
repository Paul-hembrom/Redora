import sql from './server/db.js';
async function run() {
  await sql`
    CREATE TABLE IF NOT EXISTS interactive_lessons (
      id UUID PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      user_id TEXT,
      steps JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (chapter_id, user_id)
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS manim_cache (
      prompt_hash TEXT PRIMARY KEY,
      visual_prompt TEXT NOT NULL,
      video_url TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  console.log("Tables created");
  process.exit(0);
}
run().catch(console.error);
