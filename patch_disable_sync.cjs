const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const regexStreamEnded = /      let streamEnded = false;\n      let isPlayingNext = false;/;
const replacementStreamEnded = `      let streamEnded = false;
      let isPlayingNext = false;
      let disableSync = false;`;

code = code.replace(regexStreamEnded, replacementStreamEnded);

const regexTotalChunks = /                if \(data.totalChunks !== undefined\) \{\n                  totalChunks = data.totalChunks;\n                  if \(totalChunks === 0\) \{\n                    throw new Error\('No audio chunks returned'\);\n                  \}/;
const replacementTotalChunks = `                if (data.totalChunks !== undefined) {
                  totalChunks = data.totalChunks;
                  if (totalChunks === 0) {
                    throw new Error('No audio chunks returned');
                  }
                  const expectedElements = document.querySelectorAll(\`[id^="\${idPrefix}"]\`).length;
                  if (expectedElements > 0 && totalChunks !== expectedElements) {
                    logWarning(\`Mismatch: expected \${expectedElements} DOM elements but got \${totalChunks} audio chunks. Falling back to whole-text playback (disabling sync).\`);
                    disableSync = true;
                  }
`;
code = code.replace(regexTotalChunks, replacementTotalChunks);

const regexSentenceEl = /        const domIndex = chunk.domIndex !== undefined \? chunk.domIndex : chunk.index;\n        const sentenceEl = document.getElementById\(\`\\\$\\{idPrefix\\}\\\$\\{domIndex\\}\`\);\n        console.log\(\`Scrolling to \\\$\\{idPrefix\\}\\\$\\{domIndex\\}\`, 'found:', !!sentenceEl\);\n        if \(sentenceEl\) \{\n           sentenceEl.scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\);\n        \} else \{\n           console.warn\(\`Scroll target not found: \\\$\\{idPrefix\\}\\\$\\{i\\}\`\);\n        \}/;

const replacementSentenceEl = `        const domIndex = chunk.domIndex !== undefined ? chunk.domIndex : chunk.index;
        const sentenceEl = !disableSync ? document.getElementById(\`\${idPrefix}\${domIndex}\`) : null;
        if (!disableSync) {
            console.log(\`Scrolling to \${idPrefix}\${domIndex}\`, 'found:', !!sentenceEl);
            if (sentenceEl) {
               sentenceEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
               console.warn(\`Scroll target not found: \${idPrefix}\${i}\`);
            }
        }`;
code = code.replace(regexSentenceEl, replacementSentenceEl);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched disable sync');
