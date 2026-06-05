import fs from 'fs';

let content = fs.readFileSync('src/components/InteractiveLesson.tsx', 'utf8');
content = content.replace(/onClick=\{onClose\}/g, 'onClick={handleClose}');
fs.writeFileSync('src/components/InteractiveLesson.tsx', content);
