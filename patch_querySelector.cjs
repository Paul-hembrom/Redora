const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');
code = code.replace(".z-\\[100\\]", ".z-\\\\[100\\\\]");
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
