const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldLogs = `        console.log(\`Scrolling to \${idPrefix}\${domIndex}\`, 'found:', !!sentenceEl);`;

const newLogs = `        console.log(\`[ReadAloud] Chunk \${i} - audioUrl length:\`, chunk.audioUrl ? chunk.audioUrl.length : 0);
        console.log(\`[ReadAloud] Chunk \${i} - timestamps count:\`, chunk.timestamps ? chunk.timestamps.length : 0);
        console.log(\`Scrolling to \${idPrefix}\${domIndex}\`, 'found:', !!sentenceEl);`;

if (code.includes(oldLogs)) {
    code = code.replace(oldLogs, newLogs);
    fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
    console.log('Patched frontend');
} else {
    console.log('Could not find frontend logs hook');
}
