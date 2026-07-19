const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const regex = /  const speakWithBrowser = \(\) => \{[\s\S]*?    \}, 2000\);\n  \};\n/;
code = code.replace(regex, '');
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('Removed speakWithBrowser');
