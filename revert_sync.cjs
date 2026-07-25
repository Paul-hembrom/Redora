const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

content = content.replace(/const syncTime = currentTime \/ 0\.8;/g, "");
content = content.replace(/syncTime/g, "currentTime");

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Reverted syncTime");
