import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

// Find the loop
const target = `    for (const row of rows) {
       if (!chaptersMap.has(row.title)) {
          chaptersMap.set(row.title, {
             id: \`chap_\${docId}_\${chapterNumber}\`,
             chapterNumber,
             title: row.title,
             summary: '',
             content: '',
             type: 'chapter',
             sortOrder: chapterNumber * 100,
             children: []
          });
          chapterNumber++;
          topicNumber = 1;
       }
       
       const chap = chaptersMap.get(row.title);
       
       const images = safeParseJSON(row.images);
       const videos = safeParseJSON(row.videos);
       const questions = safeParseJSON(row.questions);

       let fullContent = row.content || '';`;

const replacement = `    for (const row of rows) {
       if (!chaptersMap.has(row.title)) {
          chaptersMap.set(row.title, {
             id: \`chap_\${docId}_\${chapterNumber}\`,
             chapterNumber,
             title: row.title,
             summary: '',
             content: '',
             type: 'chapter',
             sortOrder: chapterNumber * 100,
             children: []
          });
          chapterNumber++;
          topicNumber = 1;
       }
       
       const chap = chaptersMap.get(row.title);
       
       const images = safeParseJSON(row.images);
       const videos = safeParseJSON(row.videos);
       const questions = safeParseJSON(row.questions);
       console.log(\`Topic: \${row.subtopic}, images count: \${images.length}\`);

       let fullContent = row.content || '';`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('server.ts', code);
    console.log("Patched server.ts images loop");
} else {
    console.log("Target not found!");
}
