// scripts/migrate.js — run manually with the DIRECT connection (port 5432)
import postgres from 'postgres';

const dbUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('[migrate] Neither DIRECT_DATABASE_URL nor DATABASE_URL is set');
  process.exit(1);
}

const sql = postgres(dbUrl, {
  max: 1,
  prepare: false,
});

console.log('[migrate] starting');

// Move the entire DDL block from initDb() here, in dependency order.
// IMPORTANT: `CREATE TABLE IF NOT EXISTS` must come BEFORE any ALTER TABLE
// that targets the same table.

await sql`
  CREATE TABLE IF NOT EXISTS upload_locks (
    user_id TEXT NOT NULL,
    hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '2 minutes',
    PRIMARY KEY (user_id, hash)
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tags TEXT DEFAULT '[]',
    is_public BOOLEAN DEFAULT FALSE,
    organization_id TEXT
  )
`;

await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '[]'`;
await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE`;
await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS organization_id TEXT`;
await sql`CREATE INDEX IF NOT EXISTS idx_documents_org ON documents (organization_id)`;

await sql`
  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL
  )
`;

await sql`ALTER TABLE chapters ADD COLUMN IF NOT EXISTS parent_id TEXT`;
await sql`ALTER TABLE chapters ALTER COLUMN parent_id TYPE TEXT USING parent_id::text`;
await sql`ALTER TABLE chapters ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`;
await sql`ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_type_check`;
await sql`ALTER TABLE chapters ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'chapter'`;

await sql`
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    relationship_graph TEXT,
    follow_ups TEXT,
    type TEXT,
    action_data TEXT,
    recommended_videos TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

await sql`ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_chapter_id_fkey`;
await sql`ALTER TABLE chats ALTER COLUMN chapter_id TYPE TEXT`;
await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS type TEXT`;
await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS action_data TEXT`;
await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS recommended_videos TEXT`;
await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE`;
await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb`;
await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb`;
await sql`ALTER TABLE curriculum_library ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0`;

await sql`
  CREATE TABLE IF NOT EXISTS storyboards (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    chapter_id TEXT REFERENCES chapters(id) ON DELETE CASCADE,
    generation_job_id TEXT,
    title TEXT NOT NULL,
    visual_style TEXT,
    narration_style TEXT,
    grade_level TEXT,
    subject TEXT,
    status TEXT DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;
await sql`ALTER TABLE storyboards ADD COLUMN IF NOT EXISTS generation_job_id TEXT`;

await sql`
  CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    storyboard_id TEXT NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL,
    scene_number INTEGER NOT NULL,
    narration TEXT,
    animation_instructions TEXT,
    camera_directions TEXT,
    labels TEXT,
    transition_to_next TEXT,
    estimated_duration_seconds INTEGER,
    visual_prompt TEXT,
    educational_metadata TEXT,
    video_url TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS generation_jobs (
    id TEXT PRIMARY KEY,
    org_id TEXT,
    document_id TEXT,
    chapter_id TEXT,
    status TEXT,
    progress INTEGER,
    error_message TEXT,
    video_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS narration_assets (
    id TEXT PRIMARY KEY,
    org_id TEXT,
    scene_id TEXT,
    asset_url TEXT,
    voice_name TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS visual_metadata (
    id TEXT PRIMARY KEY,
    org_id TEXT,
    scene_id TEXT,
    image_url TEXT,
    prompt TEXT,
    model_used TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

try {
  await sql`DELETE FROM visual_metadata a USING visual_metadata b WHERE a.ctid < b.ctid AND a.scene_id = b.scene_id`;
  await sql`DELETE FROM narration_assets a USING narration_assets b WHERE a.ctid < b.ctid AND a.scene_id = b.scene_id`;
  await sql`ALTER TABLE visual_metadata DROP CONSTRAINT IF EXISTS visual_metadata_scene_uniq`;
  await sql`ALTER TABLE visual_metadata ADD CONSTRAINT visual_metadata_scene_uniq UNIQUE (scene_id)`;
  await sql`ALTER TABLE narration_assets DROP CONSTRAINT IF EXISTS narration_assets_scene_uniq`;
  await sql`ALTER TABLE narration_assets ADD CONSTRAINT narration_assets_scene_uniq UNIQUE (scene_id)`;
} catch (e) {
  console.warn('[migrate] Constraints warning:', e);
}

await sql`
  CREATE TABLE IF NOT EXISTS student_memory (
    id UUID PRIMARY KEY,
    user_id TEXT NOT NULL,
    chapter_id TEXT,
    summary TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS idx_student_memory_user ON student_memory(user_id, created_at DESC)`;

await sql`
  CREATE TABLE IF NOT EXISTS job_queue (
    id UUID PRIMARY KEY,
    job_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    attempts INT NOT NULL DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
  )
`;
await sql`CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status, created_at)`;

await sql`
  CREATE TABLE IF NOT EXISTS user_usage (
    user_id TEXT PRIMARY KEY,
    books_uploaded_this_month INTEGER DEFAULT 0,
    video_generations_this_month INTEGER DEFAULT 0,
    image_searches_this_month INTEGER DEFAULT 0,
    interactive_lessons_this_month INTEGER DEFAULT 0,
    video_generations_today INTEGER DEFAULT 0,
    image_searches_today INTEGER DEFAULT 0,
    youtube_searches_today INTEGER DEFAULT 0,
    last_reset_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_daily_reset_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

await sql`ALTER TABLE user_usage ADD COLUMN IF NOT EXISTS video_generations_this_month INTEGER DEFAULT 0`;
await sql`ALTER TABLE user_usage ADD COLUMN IF NOT EXISTS image_searches_this_month INTEGER DEFAULT 0`;
await sql`ALTER TABLE user_usage ADD COLUMN IF NOT EXISTS interactive_lessons_this_month INTEGER DEFAULT 0`;
await sql`ALTER TABLE user_usage ADD COLUMN IF NOT EXISTS youtube_searches_today INTEGER DEFAULT 0`;
await sql`ALTER TABLE user_usage ADD COLUMN IF NOT EXISTS last_daily_reset_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;
await sql`ALTER TABLE user_usage ADD COLUMN IF NOT EXISTS chat_messages_this_month INTEGER DEFAULT 0`;
await sql`ALTER TABLE user_usage ADD COLUMN IF NOT EXISTS tts_requests_this_month INTEGER DEFAULT 0`;
await sql`ALTER TABLE user_usage ADD COLUMN IF NOT EXISTS ask_questions_this_month INTEGER DEFAULT 0`;

await sql`ALTER TABLE school_usage ADD COLUMN IF NOT EXISTS chat_messages_this_month INTEGER DEFAULT 0`;
await sql`ALTER TABLE school_usage ADD COLUMN IF NOT EXISTS tts_requests_this_month INTEGER DEFAULT 0`;
await sql`ALTER TABLE school_usage ADD COLUMN IF NOT EXISTS ask_questions_this_month INTEGER DEFAULT 0`;

// One-time backfill, NOT part of initialisation:
try {
  await sql`
    UPDATE documents d
    SET organization_id = om.organization_id
    FROM organization_members om
    WHERE d.organization_id IS NULL
      AND om.user_id = d.user_id
      AND (SELECT count(*) FROM organization_members x WHERE x.user_id = d.user_id) = 1
  `;
} catch (e) {
  console.warn('[migrate] Backfill warning:', e);
}

console.log('[migrate] done');
await sql.end();
