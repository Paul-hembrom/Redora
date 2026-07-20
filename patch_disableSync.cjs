const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldCheck = `                  const expectedElements = scopeRoot.querySelectorAll(\`[id^="\${idPrefix}"]\`).length;
                  if (expectedElements === 0 && !idPrefix.startsWith("tts-explanation-")) {
                    logWarning(\`No DOM elements found matching \${idPrefix}. Disabling sync.\`);
                    disableSync = true;
                  }`;

const newCheck = `                  const expectedElements = scopeRoot.querySelectorAll(\`[id^="\${idPrefix}"]\`).length;
                  const fallbackElements = document.querySelectorAll('[id^="tts-sentence-"]').length;
                  if (expectedElements === 0 && fallbackElements === 0 && !idPrefix.startsWith("tts-explanation-")) {
                    logWarning(\`No DOM elements found matching \${idPrefix} or fallback. Disabling sync.\`);
                    disableSync = true;
                  }`;

code = code.replace(oldCheck, newCheck);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("Patched disableSync");
