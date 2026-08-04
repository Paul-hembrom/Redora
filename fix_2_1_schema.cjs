require('dotenv').config();
const postgres = require('postgres');
async function main() {
  const sql = postgres(process.env.DATABASE_URL);
  
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
  await sql`CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status, created_at);`;
  console.log('Queue created');
  process.exit(0);
}
main().catch(console.error);
