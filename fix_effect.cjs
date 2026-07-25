const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

content = content.replace(/useEffect\(\(\) => \{\n\s*if \(audioRef\.current\) \{\n\s*audioRef\.current\.playbackRate = playbackRate;\n\s*\}\n\s*\}, \[playbackRate\]\);\n/g, "");

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Removed playbackRate effect");
