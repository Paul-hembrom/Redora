const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldRemove = `        const removeHighlights = () => {
            wordSpans.forEach(span => {
                if (span) span.classList.remove('bg-amber-400/70');
            });
        };`;

const newRemove = `        const removeHighlights = () => {
            wordSpans.forEach((span, k) => {
                let domSpan = document.getElementById(\`tts-word-\${i}-\${k}\`);
                if (!domSpan) domSpan = span;
                if (domSpan) domSpan.classList.remove('bg-amber-400/70');
            });
        };`;

code = code.replace(oldRemove, newRemove);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("Patched removeHighlights");
