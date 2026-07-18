const fs = require('fs');
const path = 'src/components/ChatArea.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/grade: 'High School',\s*subject: 'General Education',/g, `grade: undefined,
                        subject: undefined,`);

fs.writeFileSync(path, content);
