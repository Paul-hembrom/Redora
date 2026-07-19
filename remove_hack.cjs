const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const hackRegex = /\s*\/\/\s*Small offset for the first chunk to align highlighting with audio start\s*if\s*\(i\s*===\s*0\)\s*\{\s*setTimeout\(\(\)\s*=>\s*\{\s*if\s*\(!audio\.paused\)\s*requestAnimationFrame\(updateHighlights\);\s*\},\s*150\);\s*audio\.onplay\s*=\s*null;\s*\/\/\s*Prevent the default onplay from firing immediately\s*\}/g;

code = code.replace(hackRegex, '');
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('removed hack');
