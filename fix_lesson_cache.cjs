const fs = require('fs');
let content = fs.readFileSync('server/lessonOrchestrator.ts', 'utf-8');

const topStr = `export async function createInteractiveLesson(topicId: string, userId: string,
providedTitle?: string, providedContent?: string) {`;

const topNew = `export async function createInteractiveLesson(topicId: string, userId: string,
providedTitle?: string, providedContent?: string) {
  try {
    const cached = await sql\`
      SELECT steps FROM interactive_lessons
      WHERE chapter_id = \${topicId} AND user_id = \${userId}
      LIMIT 1
    \`;
    if (cached.length) {
      console.log('[lesson] Serving cached lesson for', topicId);
      return typeof cached[0].steps === 'string' ? JSON.parse(cached[0].steps) : cached[0].steps;
    }
  } catch (e) {
    // Ignore if table doesn't exist yet
  }`;

content = content.replace(topStr, topNew);

const bottomStr = `  // Synthesize speech for every step that has narration
  return steps;
}`;

const bottomNew = `  try {
    await sql\`
      INSERT INTO interactive_lessons (id, chapter_id, user_id, steps)
      VALUES (\${uuidv4()}, \${topicId}, \${userId}, \${sql.json(steps)})
      ON CONFLICT (chapter_id, user_id) DO UPDATE SET steps = EXCLUDED.steps, created_at = NOW()
    \`;
  } catch (e) {
    console.error("Failed to cache lesson:", e);
  }
  return steps;
}`;

content = content.replace(bottomStr, bottomNew);

fs.writeFileSync('server/lessonOrchestrator.ts', content);
console.log("Fixed lesson cache");
