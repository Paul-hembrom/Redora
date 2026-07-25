const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const regex1 = /const removeHighlights = \(\) => \{[\s\S]*?\};/m;
const repl1 = `const removeHighlights = () => {
            wordSpans.forEach((span, k) => {
                let domSpan = document.getElementById(\`tts-word-\${i}-\${k}\`);
                if (!domSpan) domSpan = span;
                if (domSpan) {
                    domSpan.classList.remove('bg-amber-400/70');
                    domSpan.style.background = '';
                    domSpan.style.webkitBackgroundClip = '';
                    domSpan.style.backgroundClip = '';
                    domSpan.style.color = '';
                }
            });
        };`;
content = content.replace(regex1, repl1);

const regex2 = /if \(chunk\.timestamps && chunk\.timestamps\.length > 0\) \{[\s\S]*?\}\);[\s\S]*?\}/m;
const repl2 = `if (chunk.timestamps && chunk.timestamps.length > 0) {
                chunk.timestamps.forEach((ts: any, k: number) => {
                    let span = document.getElementById(\`tts-word-\${i}-\${k}\`);
                    if (!span) span = wordSpans[k];
                    if (!span) return;

                    const start_time = ts.start_time !== undefined ? ts.start_time : ts.start;
                    const end_time = ts.end_time !== undefined ? ts.end_time : ts.end;

                    let startAdjusted = start_time;
                    let endAdjusted = end_time;
                    if (i === 0) {
                        startAdjusted -= 0.150;
                        endAdjusted -= 0.150;
                    }

                    if (currentTime >= startAdjusted && currentTime < endAdjusted) {
                        const duration = endAdjusted - startAdjusted;
                        const progress = duration > 0 ? Math.max(0, Math.min(1, (currentTime - startAdjusted) / duration)) : 1;
                        span.style.background = \`linear-gradient(to right, #FBBF24 \${progress * 100}%, transparent \${progress * 100}%)\`;
                        span.style.webkitBackgroundClip = 'text';
                        span.style.backgroundClip = 'text';
                        span.style.color = 'transparent';
                        span.classList.remove('bg-amber-400/70');
                    } else {
                        span.style.background = '';
                        span.style.webkitBackgroundClip = '';
                        span.style.backgroundClip = '';
                        span.style.color = '';
                        span.classList.remove('bg-amber-400/70');
                    }
                });
            }`;
content = content.replace(regex2, repl2);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Patched successfully");
