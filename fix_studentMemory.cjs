const fs = require('fs');
let content = fs.readFileSync('server/studentMemory.ts', 'utf-8');

content = content.replace(
  'const apiKey = process.env.GEMINI_API_KEY;\n    if (!apiKey) return;',
  `const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[memory] No Gemini key configured; skipping memory generation.');
      return;
    }`
);

content = content.replace(
  `.replace(/ignore .{0,40}(previous|prior|above) .{0,20}instructions?/gi, '')`,
  `.replace(/ignore .{0,40}(previous|prior|above) .{0,20}instructions?/gi, '').replace(/system\\s*prompt|you are now|disregard .{0,20}rules?/gi, '')`
);

content = content.replace(
  `       const memories = await sql\`
         SELECT summary FROM student_memory
          WHERE user_id = \${userId}
          ORDER BY created_at DESC
          LIMIT 3
       \`;`,
  `       const memories = await sql\`
         SELECT summary FROM student_memory
          WHERE user_id = \${userId}
            AND (chapter_id = \${currentChapterId} OR chapter_id IS NULL)
          ORDER BY created_at DESC
          LIMIT 3
       \`;`
);

fs.writeFileSync('server/studentMemory.ts', content);
console.log("Fixed studentMemory");
