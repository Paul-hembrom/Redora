const fs = require('fs');

let db = fs.readFileSync('server/db.ts', 'utf-8');

const targetStr = `    await sql\`
      CREATE TABLE IF NOT EXISTS student_memory (
        id UUID PRIMARY KEY,
        user_id TEXT NOT NULL,
        chapter_id TEXT,
        summary TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_student_memory_user ON student_memory(user_id, created_at DESC);
      
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
      CREATE TABLE IF NOT EXISTS user_usage (
        user_id TEXT PRIMARY KEY,
        books_uploaded_this_month INTEGER DEFAULT 0,
        video_generations_this_month INTEGER DEFAULT 0,
        image_searches_this_month INTEGER DEFAULT 0,
        interactive_lessons_this_month INTEGER DEFAULT 0,
        video_generations_today INTEGER DEFAULT 0,
        image_searches_today INTEGER DEFAULT 0,
        last_reset_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    \`;`;

const newStr = `    await sql\`
      CREATE TABLE IF NOT EXISTS student_memory (
        id UUID PRIMARY KEY,
        user_id TEXT NOT NULL,
        chapter_id TEXT,
        summary TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    \`;
    await sql\`CREATE INDEX IF NOT EXISTS idx_student_memory_user ON student_memory(user_id, created_at DESC)\`;
    
    await sql\`
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
    \`;
    await sql\`CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status, created_at)\`;
    
    await sql\`
      CREATE TABLE IF NOT EXISTS user_usage (
        user_id TEXT PRIMARY KEY,
        books_uploaded_this_month INTEGER DEFAULT 0,
        video_generations_this_month INTEGER DEFAULT 0,
        image_searches_this_month INTEGER DEFAULT 0,
        interactive_lessons_this_month INTEGER DEFAULT 0,
        video_generations_today INTEGER DEFAULT 0,
        image_searches_today INTEGER DEFAULT 0,
        last_reset_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    \`;`;

db = db.replace(targetStr, newStr);
fs.writeFileSync('server/db.ts', db);
