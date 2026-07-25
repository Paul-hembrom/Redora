const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const regex = /\s*if \(audio\.parentElement\) \{\s*audio\.parentElement\.removeChild\(audio\);\s*\}/g;
content = content.replace(regex, '');

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Patched successfully");
