import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target1 = `    // Save user message to DB
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
const replacement1 = `    // Ephemeral media message, don't save to DB`;
code = code.replace(target1, replacement1);

const target2 = `      if (!chapter.id.startsWith('lib_')) {
        fetch('/api/chats', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` } : {})
        },
          body: JSON.stringify({ ...aiMsg, chapterId: chapter.id, chapterContent: chapter.content })
        }).catch(console.error);
      }`;
const replacement2 = `      // Ephemeral media message, don't save to DB`;
// Replace BOTH instances (images and videos)
code = code.split(target2).join(replacement2);

const target3 = `    if (!chapter.id.startsWith('lib_')) {
      fetch('/api/chats', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` } : {})
        },
        body: JSON.stringify({ ...userMsg, chapterId: chapter.id, chapterContent: chapter.content })
      }).catch(console.error);
    }`;

// Wait, the first one is for images? No, target1 was for videos user message.
// Let's replace the one for images too.
code = code.replace(target3, `    // Ephemeral media message, don't save to DB`);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Replaced successfully!");
