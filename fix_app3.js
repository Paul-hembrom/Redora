import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

code = code.replace(/text={typeof chapter.content === 'string' \? chapter.content : \(chapter.summary \|\| ''\)}/g, "text={smartNormalizeText(typeof chapter.content === 'string' ? chapter.content : (chapter.summary || ''))}");

fs.writeFileSync('src/components/ChatArea.tsx', code);
