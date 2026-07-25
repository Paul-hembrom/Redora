const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');
content = content.replace('        let hasScrolled = false;', '        let hasScrolled = false;'); // just simple replacement
fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
