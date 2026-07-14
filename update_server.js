import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const search = `  app.get("/api/curriculum", async (req: any, res) => {
  try {
    let { grade, subject } = req.query;`;

const replace = `  app.get("/api/curriculum", async (req: any, res) => {
  console.log('>>> /api/curriculum HIT – query:', req.query);
  try {
    let { grade, subject } = req.query;`;

code = code.replace(search, replace);

const search2 = `      const doc = {
          id: docId,
          name: \`\${grade} - \${subject} Curriculum\`,
          uploadDate: new Date().toISOString(),
          chapters: [] as any[],
          isPublic: true
      };
      return res.json(doc);
    }`;

const replace2 = `      const doc = {
          id: docId,
          name: \`\${grade} - \${subject} Curriculum\`,
          uploadDate: new Date().toISOString(),
          chapters: [] as any[],
          isPublic: true
      };
      console.log('>>> /api/curriculum sending doc – chapters:', doc.chapters?.length, 'first title:', doc.chapters?.[0]?.title);
      return res.json(doc);
    }`;
    
code = code.replace(search2, replace2);

const search3 = `    doc.chapters.sort((a, b) => a.sortOrder - b.sortOrder);
    
    const jsonStr = JSON.stringify(doc);
    console.log(\`[Curriculum API] Response JSON (truncated): \${jsonStr.substring(0, 500)}...\`);
    
    res.json(doc);`;

const replace3 = `    doc.chapters.sort((a, b) => a.sortOrder - b.sortOrder);
    
    const jsonStr = JSON.stringify(doc);
    console.log(\`[Curriculum API] Response JSON (truncated): \${jsonStr.substring(0, 500)}...\`);
    console.log('>>> /api/curriculum sending doc – chapters:', doc.chapters?.length, 'first title:', doc.chapters?.[0]?.title);
    res.json(doc);`;

code = code.replace(search3, replace3);

fs.writeFileSync('server.ts', code);
