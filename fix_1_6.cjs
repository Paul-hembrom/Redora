const fs = require('fs');
let content = fs.readFileSync('server/lessonOrchestrator.ts', 'utf-8');

const targetQuery = `    // Try to find an existing storyboard for this topic/chapter
    const storyboards = await sql\`
      SELECT id FROM storyboards 
      WHERE chapter_id = \${lookupChapterId} AND status = 'completed'
      ORDER BY created_at DESC 
      LIMIT 1
    \`;`;

const replacementQuery = `    // Try to find an existing storyboard for this topic/chapter
    const storyboards = await sql\`
      SELECT id FROM storyboards 
      WHERE chapter_id IN (\${topicId}, \${lookupChapterId}) AND status = 'completed'
      ORDER BY created_at DESC 
      LIMIT 1
    \`;`;

content = content.replace(targetQuery, replacementQuery);
fs.writeFileSync('server/lessonOrchestrator.ts', content);
