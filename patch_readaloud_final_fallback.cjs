const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const fallbackReplace = `        if (!sentenceEl) {
            sentenceEl = document.getElementById(\`tts-sentence-\${i}\`) as HTMLElement | null;
        }`;

const fallbackNew = `        if (!sentenceEl) {
            sentenceEl = document.getElementById(\`tts-sentence-\${i}\`) as HTMLElement | null;
        }
        if (!sentenceEl && buttonRef.current) {
            // Fallback for ChatArea chat message bubbles
            const bubble = buttonRef.current.closest('.group\\\\/bubble');
            if (bubble) {
                sentenceEl = bubble.querySelector('.prose') as HTMLElement | null;
            }
        }`;
code = code.replace(fallbackReplace, fallbackNew);

const disableSyncOld = `                  if (expectedElements === 0 && fallbackElements === 0 && !idPrefix.startsWith("tts-explanation-")) {
                    logWarning(\`No DOM elements found matching \${idPrefix} or fallback. Disabling sync.\`);
                    disableSync = true;
                  }`;
const disableSyncNew = `                  if (expectedElements === 0 && fallbackElements === 0 && !idPrefix.startsWith("tts-explanation-")) {
                    // Try to see if we have a fallback bubble
                    const bubble = buttonRef.current?.closest('.group\\\\/bubble');
                    if (!bubble) {
                        logWarning(\`No DOM elements found matching \${idPrefix} or fallback. Disabling sync.\`);
                        disableSync = true;
                    }
                  }`;
code = code.replace(disableSyncOld, disableSyncNew);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("Patched ReadAloudButton for bubble fallback");
