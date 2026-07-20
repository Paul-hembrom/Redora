const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

code = code.replace(/text\.replace\(\/### Related Videos\[\\\\s\\\\S\]\*\?\(\?\=### \|\$\)\/, ''\)\.trim\(\)/, "text.replace(/### Related Videos[\\s\\S]*?(?=### |$)/, '').trim()");

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('Patched');
