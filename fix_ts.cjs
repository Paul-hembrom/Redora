const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

content = content.replace(/window\._lastRafLog/g, "(window as any)._lastRafLog");

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Fixed TS error");
