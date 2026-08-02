const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf-8');
code = code.replace("`\\b${regexPattern}`", "`\\\\b${regexPattern}`");
code = code.replace("`${regexPattern}\\b`", "`${regexPattern}\\\\b`");
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
