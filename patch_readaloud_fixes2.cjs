const fs = require('fs');
let btnCode = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldStr = `                  const expectedElements = scopeRoot.querySelectorAll(\`[id^="\${idPrefix}"]\`).length;
                  if (expectedElements > 0 && totalChunks !== expectedElements) {
                    logWarning(\`Mismatch: expected \${expectedElements} DOM elements but got \${totalChunks} audio chunks. Falling back to whole-text playback (disabling sync).\`);
                    disableSync = true;
                  }`;

const newStr = `                  const expectedElements = scopeRoot.querySelectorAll(\`[id^="\${idPrefix}"]\`).length;
                  if (expectedElements === 0 && idPrefix !== "tts-explanation-") {
                    logWarning(\`No DOM elements found matching \${idPrefix}. Disabling sync.\`);
                    disableSync = true;
                  }`;

btnCode = btnCode.replace(oldStr, newStr);
fs.writeFileSync('src/components/ReadAloudButton.tsx', btnCode);
console.log('patched ReadAloudButton.tsx');
