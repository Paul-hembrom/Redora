import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target3 = `    // Save user message to DB
    if (!chapter.id.startsWith('lib_')) {
      fetch('/api/chats', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` } : {})
        },
        body: JSON.stringify({ ...userMsg, chapterId: chapter.id, chapterContent: chapter.content })
      }).catch(console.error);
    }`;

code = code.replace(target3, `    // Ephemeral media message, don't save to DB`);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Replaced successfully!");
