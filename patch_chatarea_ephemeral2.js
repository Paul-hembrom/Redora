import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// For handleFetchImages userMsg:
code = code.replace(/const userMsg: ChatMessage = \{ id: uuidv4\(\), role: 'user', text: "Find educational images for this chapter." \};\n\s*setMessages\(prev => \[\.\.\.prev, userMsg\]\);\n\s*setIsTyping\(true\);\n\s*setError\(null\);\n\n\s*if \(!chapter\.id\.startsWith\('lib_'\)\) \{\n\s*fetch\('\/api\/chats', \{\n\s*method: 'POST',\n\s*headers: \{\s*'Content-Type': 'application\/json',\n\s*\.\.\.\(localStorage\.getItem\('token'\) \? \{ 'Authorization': \`Bearer \$\{localStorage\.getItem\('token'\)\}\` \} : \{\}\)\n\s*\},\n\s*body: JSON\.stringify\(\{ \.\.\.userMsg, chapterId: chapter\.id, chapterContent: chapter\.content \}\)\n\s*\}\)\.catch\(console\.error\);\n\s*\}/g,
\`const userMsg: ChatMessage = { id: uuidv4(), role: 'user', text: "Find educational images for this chapter." };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setError(null);
    // userMsg is ephemeral for images\`);

// For handleFetchImages aiMsg:
code = code.replace(/if \(!chapter\.id\.startsWith\('lib_'\)\) \{\n\s*fetch\('\/api\/chats', \{\n\s*method: 'POST',\n\s*headers: \{\s*'Content-Type': 'application\/json',\n\s*\.\.\.\(localStorage\.getItem\('token'\) \? \{ 'Authorization': \`Bearer \$\{localStorage\.getItem\('token'\)\}\` \} : \{\}\)\n\s*\},\n\s*body: JSON\.stringify\(\{ \.\.\.aiMsg, chapterId: chapter\.id, chapterContent: chapter\.content \}\)\n\s*\}\)\.catch\(console\.error\);\n\s*\}/g,
\`// aiMsg is ephemeral for images and videos\`);

// For handleFetchVideos userMsg:
code = code.replace(/\/\/ Save user message to DB\n\s*if \(!chapter\.id\.startsWith\('lib_'\)\) \{\n\s*fetch\('\/api\/chats', \{\n\s*method: 'POST',\n\s*headers: \{\s*'Content-Type': 'application\/json',\n\s*\.\.\.\(localStorage\.getItem\('token'\) \? \{ 'Authorization': \`Bearer \$\{localStorage\.getItem\('token'\)\}\` \} : \{\}\)\n\s*\},\n\s*body: JSON\.stringify\(\{ \.\.\.userMsg, chapterId: chapter\.id, chapterContent: chapter\.content \}\)\n\s*\}\)\.catch\(console\.error\);\n\s*\}/g,
\`// userMsg is ephemeral for videos\`);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched!");
