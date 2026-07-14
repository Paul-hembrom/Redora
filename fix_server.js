import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const search = `    const rows = await sql\`SELECT * FROM curriculum_library WHERE grade = \${grade} AND subject = \${subject} ORDER BY title, subtopic\`;
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Curriculum content not yet available for this grade and subject.' });
    }`;

const replace = `    const rows = await sql\`SELECT * FROM curriculum_library WHERE grade = \${grade} AND subject = \${subject} ORDER BY title, subtopic\`;
    console.log(\`/api/curriculum requested for grade: \${grade}, subject: \${subject}. Found \${rows.length} rows.\`);

    if (rows.length === 0) {
      const docId = \`curr_\${grade}_\${subject}\`.replace(/\\s+/g, '_');
      const doc = { 
         id: docId, 
         name: \`\${grade} - \${subject} Curriculum\`, 
         uploadDate: new Date().toISOString(), 
         chapters: [] as any[], 
         isPublic: true
      };
      return res.json(doc);
    }`;

code = code.replace(search, replace);
fs.writeFileSync('server.ts', code);
