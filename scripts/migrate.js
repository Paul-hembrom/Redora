import postgres from 'postgres';

const directUrl =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!directUrl) {
  console.error('No database URL provided in environment.');
  process.exit(1);
}

console.log('Running manual migration script against direct connection...');
const sql = postgres(directUrl, { max: 1, prepare: false });

async function runMigration() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tags TEXT DEFAULT '[]',
        is_public BOOLEAN DEFAULT FALSE,
        content_hash TEXT
      );
    `;

    await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT`;
    await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '[]'`;
    await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE`;

    await sql`
      CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        chapter_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        content TEXT NOT NULL
      );
    `;

    await sql`ALTER TABLE chapters ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES chapters(id) ON DELETE CASCADE`;
    await sql`ALTER TABLE chapters ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`;
    await sql`ALTER TABLE chapters ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'chapter'`;

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
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status, created_at)`;

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sql.end();
  }
}

runMigration();
