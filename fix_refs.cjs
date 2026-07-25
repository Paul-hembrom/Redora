const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

content = content.replace(/audioQueueRef\.currentRef\.current/g, "audioQueueRef.current");
content = content.replace(/audioQueueRef\.currentRef/g, "audioQueueRef");
content = content.replace(/chunksMapRef\.currentRef\.current/g, "chunksMapRef.current");
content = content.replace(/chunksMapRef\.currentRef/g, "chunksMapRef");
content = content.replace(/audioQueueRef\.current\.current/g, "audioQueueRef.current");
content = content.replace(/chunksMapRef\.current\.current/g, "chunksMapRef.current");


// Also break the reader loop if stopIntentRef.current is true
content = content.replace(/const { done, value } = await reader\.read\(\);/g, `if (stopIntentRef.current) break;\n            const { done, value } = await reader.read();`);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Fixed refs");
