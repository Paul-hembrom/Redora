import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const search = `    if (rows.length === 0) {
      return res.status(404).json({ error: 'Curriculum content not yet available for this grade and subject.' });
    }
    
    // Group by title
    const docId = \`curr_\${grade}_\${subject}\`.replace(/\\s+/g, '_');
    const doc = { 
       id: docId, 
       name: \`\${grade} - \${subject} Curriculum\`, 
       uploadDate: new Date().toISOString(), 
       chapters: [] as any[], 
       isPublic: true
    };`;

const replace = `    const docId = \`curr_\${grade}_\${subject}\`.replace(/\\s+/g, '_');
    const doc = { 
       id: docId, 
       name: \`\${grade} - \${subject} Curriculum\`, 
       uploadDate: new Date().toISOString(), 
       chapters: [] as any[], 
       isPublic: true
    };
    
    if (rows.length === 0) {
      return res.json(doc);
    }`;

code = code.replace(search, replace);
fs.writeFileSync('server.ts', code);
