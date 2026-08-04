const fs = require('fs');
let code = fs.readFileSync('server/db.ts', 'utf-8');

const jobQueueTable = `
      CREATE TABLE IF NOT EXISTS job_queue (
        id UUID PRIMARY KEY,
        job_type TEXT NOT NULL,
        payload JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status, created_at);
`;

code = code.replace(
  "CREATE TABLE IF NOT EXISTS user_usage",
  jobQueueTable.trim() + "\n      CREATE TABLE IF NOT EXISTS user_usage"
);

fs.writeFileSync('server/db.ts', code);
