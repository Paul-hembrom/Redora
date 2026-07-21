const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldCode = `           const sentenceSpan = document.getElementById(\`tts-sentence-\${i}\`);
           if (sentenceSpan) {
             sentenceSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
           } else {
             // Fallback for our own dynamic domIndex scrolling
             const domIndex = chunk.domIndex !== undefined ? chunk.domIndex : chunk.index;
             let fallbackEl = getScopeRoot().querySelector(\`[id="\${idPrefix}\${domIndex}"]\`) as HTMLElement | null;
             if (!fallbackEl && buttonRef.current) {
                 const bubble = buttonRef.current.closest('.group\\\\/bubble');
                 if (bubble) fallbackEl = bubble.querySelector('.prose') as HTMLElement | null;
             }
             if (fallbackEl) {
                 fallbackEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
             }
           }`;

const newCode = `           // Sentence scrolling is now handled globally by useScrollSync hook.`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("Removed sentence scroll from ReadAloudButton");
