const fs = require('fs');

// Add student_memory table to db.ts
let dbCode = fs.readFileSync('server/db.ts', 'utf-8');
const dbTarget = `CREATE TABLE IF NOT EXISTS job_queue`;
const dbReplace = `CREATE TABLE IF NOT EXISTS student_memory (
        id UUID PRIMARY KEY,
        user_id TEXT NOT NULL,
        chapter_id TEXT,
        summary TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_student_memory_user ON student_memory(user_id, created_at DESC);
      
      CREATE TABLE IF NOT EXISTS job_queue`;
dbCode = dbCode.replace(dbTarget, dbReplace);
fs.writeFileSync('server/db.ts', dbCode);

// Modify saveSessionMemory in studentMemory.ts
let memCode = fs.readFileSync('server/studentMemory.ts', 'utf-8');
const memTarget = `    await sql\`
      INSERT INTO chats (id, chapter_id, user_id, role, text, type)
      VALUES (\${uuidv4()}, \${chapterId}, \${userId}, 'system', \${summaryText}, 'memory')
    \`;`;
const memReplace = `    await sql\`
      INSERT INTO student_memory (id, user_id, chapter_id, summary)
      VALUES (\${uuidv4()}, \${userId}, \${chapterId}, \${summaryText})
    \`;`;
memCode = memCode.replace(memTarget, memReplace);
fs.writeFileSync('server/studentMemory.ts', memCode);
