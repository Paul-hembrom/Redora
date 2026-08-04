const fs = require('fs');
let code = fs.readFileSync('server/lessonOrchestrator.ts', 'utf-8');

const target = `const storyboards = await sql\`
      SELECT id FROM storyboards
      WHERE chapter_id = \${lookupChapterId} AND status = 'completed'
      ORDER BY created_at DESC LIMIT 1
    \`;`;

const replace = `const storyboards = await sql\`
      SELECT id FROM storyboards
      WHERE chapter_id IN (\${topicId}, \${lookupChapterId})
        AND status = 'completed'
      ORDER BY created_at DESC LIMIT 1
    \`;`;

code = code.replace(target, replace);
fs.writeFileSync('server/lessonOrchestrator.ts', code);
