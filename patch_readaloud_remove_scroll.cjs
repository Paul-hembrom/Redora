const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const scrollLogic = `        if (!disableSync) {
          console.log(\`Scrolling to \${idPrefix}\${domIndex}\`, 'found:', !!sentenceEl);
          if (sentenceEl) {
            sentenceEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            console.warn(\`Scroll target not found: \${idPrefix}\${i}\`);
            // Fallback for explicitly requested tts-sentence-{i}
            document.getElementById(\`tts-sentence-\${i}\`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }`;

code = code.replace(scrollLogic, `        // Scrolling now happens in audio.onplay`);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("Removed early scroll");
