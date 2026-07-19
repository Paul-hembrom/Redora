const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const badLine = "if (/\\\\(?:int|sum|begin|sin|cos|lim|tan|prod|theta|alpha|beta|gamma|omega|sigma)|\\[a-zA-Z]+|\\\\{|\\\\}/i.test(chunk.text)) {";
const goodLine = "if (/\\\\[a-zA-Z]+|\\\\{|\\\\}/.test(chunk.text)) {";

if (code.includes(badLine)) {
    code = code.replace(badLine, goodLine);
    fs.writeFileSync('server.ts', code);
    console.log('patched regex');
} else {
    console.log('could not find line');
}
