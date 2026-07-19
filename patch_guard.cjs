const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldGuard = `        // Guard: Check if the text matches (to avoid erratic highlighting if chunks don't align)
        if (sentenceEl && chunk.text) {
           const domText = sentenceEl.textContent || '';
           // Just a basic length sanity check (if they are vastly different, skip highlighting)
           if (Math.abs(domText.length - chunk.text.length) > 50) {
               console.warn(\`Highlighting disabled for chunk \${i} due to length mismatch (DOM: \${domText.length}, Chunk: \${chunk.text.length})\`);
               shouldHighlight = false;
           }
        }`;
const newGuard = `        // Guard: Check if the text matches (to avoid erratic highlighting if chunks don't align)
        if (sentenceEl && chunk.text) {
           const domText = sentenceEl.textContent || '';
           // Ensure the chunk text is actually found within the DOM text
           if (domText.indexOf(chunk.text) === -1 && domText.toLowerCase().indexOf(chunk.text.toLowerCase()) === -1) {
               console.warn(\`Highlighting disabled for chunk \${i} because chunk text not found in DOM block\`);
               shouldHighlight = false;
           }
        }`;

code = code.replace(oldGuard, newGuard);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched guard');
