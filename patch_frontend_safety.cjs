const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldGuard = `        // Guard: Check if the text matches (to avoid erratic highlighting if chunks don't align)
        if (sentenceEl && chunk.text) {
           const domText = sentenceEl.textContent || '';
           // Ensure the chunk text is actually found within the DOM text
           if (domText.indexOf(chunk.text) === -1 && domText.toLowerCase().indexOf(chunk.text.toLowerCase()) === -1) {
               console.warn(\`Highlighting disabled for chunk \${i} because chunk text not found in DOM block\`);
               shouldHighlight = false;
           }
        }`;

const newGuard = `        // Guard: Check if the text matches (to avoid erratic highlighting if chunks don't align)
        // Safety check: If the chunk text (sentence) doesn't perfectly match what we expect in the frontend block, 
        // skip word highlighting for this chunk entirely (block-level scrolling still works).
        if (sentenceEl && chunk.text) {
           const domText = sentenceEl.textContent || '';
           if (domText.indexOf(chunk.text) === -1 && domText.toLowerCase().indexOf(chunk.text.toLowerCase()) === -1) {
               console.warn(\`Highlighting disabled for chunk \${i} because chunk text not found in DOM block\`);
               shouldHighlight = false;
           }
        }`;

code = code.replace(oldGuard, newGuard);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched frontend safety comment');
