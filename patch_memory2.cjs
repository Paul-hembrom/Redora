const fs = require('fs');
let code = fs.readFileSync('server/studentMemory.ts', 'utf-8');

const target = `    const memories = await sql\`
      SELECT summary FROM student_memory
      WHERE user_id = \${userId}
      ORDER BY created_at DESC
      LIMIT 3\`;`;

const replace = `    const memories = await sql\`
      SELECT summary FROM student_memory
      WHERE user_id = \${userId}
        AND (chapter_id = \${currentChapterId} OR chapter_id IS NULL)
      ORDER BY created_at DESC
      LIMIT 3\`;`;

code = code.replace(target, replace);
fs.writeFileSync('server/studentMemory.ts', code);
