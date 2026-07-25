const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const regex = /\/\/ Guard against sparse-array holes[\s\S]*?preload = "auto";\s*\}/g;
content = content.replace(regex, '');

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Patched successfully");
