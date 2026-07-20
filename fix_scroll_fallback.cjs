const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

code = code.replace(
    /if \(sentenceEl\) \{\n\s*sentenceEl\.scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\);\n\s*\} else \{\n\s*console\.warn\(\`Scroll target not found: \$\{idPrefix\}\$\{i\}\`\);\n\s*\}/,
    `if (sentenceEl) {
            sentenceEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            console.warn(\`Scroll target not found: \${idPrefix}\${i}\`);
            // Fallback for explicitly requested tts-sentence-{i}
            document.getElementById(\`tts-sentence-\${i}\`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }`
);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
