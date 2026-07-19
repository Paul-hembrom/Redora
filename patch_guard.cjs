const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldCheck = `        const ranges: (Range | null)[] = [];
        if (chunk.timestamps && chunk.timestamps.length > 0 && sentenceEl) {
            const walker = document.createTreeWalker(sentenceEl, NodeFilter.SHOW_TEXT, null);`;

const newCheck = `        const ranges: (Range | null)[] = [];
        let shouldHighlight = true;
        
        // Guard: Check if the text matches (to avoid erratic highlighting if chunks don't align)
        if (sentenceEl && chunk.text) {
           const domText = sentenceEl.textContent || '';
           // Just a basic length sanity check (if they are vastly different, skip highlighting)
           if (Math.abs(domText.length - chunk.text.length) > 50) {
               console.warn(\`Highlighting disabled for chunk \${i} due to length mismatch (DOM: \${domText.length}, Chunk: \${chunk.text.length})\`);
               shouldHighlight = false;
           }
        }
        
        if (shouldHighlight && chunk.timestamps && chunk.timestamps.length > 0 && sentenceEl) {
            const walker = document.createTreeWalker(sentenceEl, NodeFilter.SHOW_TEXT, null);`;

code = code.replace(oldCheck, newCheck);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched guard');
