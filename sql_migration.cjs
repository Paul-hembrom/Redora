const postgres = require('postgres');

async function run() {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  try {
    await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS documents_user_hash_uniq ON documents(user_id, content_hash)`;
    await sql`
      CREATE TABLE IF NOT EXISTS upload_locks (
        hash TEXT PRIMARY KEY,
        user_id UUID NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
      )
    `;
    console.log("Migration successful");
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
run();
