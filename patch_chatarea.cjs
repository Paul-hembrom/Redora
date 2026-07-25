const fs = require('fs');
let content = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const regex = /<option value=\{0\.5\}>0\.5x<\/option>\s*<option value=\{0\.8\}>0\.8x<\/option>\s*<option value=\{1\}>1\.0x<\/option>\s*<option value=\{1\.5\}>1\.5x<\/option>/m;
const repl = `<option value={0.8}>0.8x</option>
               <option value={1}>1.0x</option>
               <option value={1.25}>1.25x</option>`;

content = content.replace(regex, repl);
fs.writeFileSync('src/components/ChatArea.tsx', content);
console.log("Patched ChatArea successfully");
