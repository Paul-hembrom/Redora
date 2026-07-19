const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
    "if (/\\\\\\\\(?:int|sum|begin|sin|cos|lim|frac|sqrt|tan|prod|theta|alpha|beta|gamma|omega|sigma)|\\\\\\\\{|\\\\\\\\}/i.test(chunk.text)) {",
    "if (/\\\\(?:int|sum|begin|sin|cos|lim|frac|sqrt|tan|prod|theta|alpha|beta|gamma|omega|sigma)|\\\\{|\\\\}/i.test(chunk.text)) {"
);
fs.writeFileSync('server.ts', code);
console.log('patched regex again');
