const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const targetScroll = `            if (currentTime > 0.05 && !hasScrolled) {
               hasScrolled = true;
               const sentenceSpan = document.getElementById(\`tts-sentence-\${i}\`);
               if (sentenceSpan) {
                 sentenceSpan.scrollIntoView({ behavior: 'smooth', block: 'start' });
               } else {
                 const domIndex = chunk.domIndex !== undefined ? chunk.domIndex : chunk.index;
                 const scopeRoot = getScopeRoot();
                 let fallbackEl = scopeRoot.querySelector(\`[id="\${idPrefix}\${domIndex}"]\`);
                 if (!fallbackEl && idPrefix.startsWith("tts-explanation-")) {
                     fallbackEl = scopeRoot.querySelector(\`[id="\${idPrefix}0"]\`);
                 }
                 if (fallbackEl) {
                     fallbackEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                 }
               }
            }`;

const replacementScroll = `            if (currentTime > 0.05 && !hasScrolled) {
               hasScrolled = true;

               const isFocusMode = localStorage.getItem('readora_focus_mode') === 'true';
               const focusSize = localStorage.getItem('readora_focus_font_size') || 'xl';
               const isLargeFont = isFocusMode && ['3xl', '4xl', '5xl', '6xl'].includes(focusSize);

               const doScroll = (el: Element) => {
                 if (isLargeFont) {
                   const rect = el.getBoundingClientRect();
                   const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                   const targetY = rect.top + scrollTop - 20;
                   window.scrollTo({ top: targetY, behavior: 'smooth' });
                 } else {
                   el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                 }
               };

               const sentenceSpan = document.getElementById(\`tts-sentence-\${i}\`);
               if (sentenceSpan) {
                 doScroll(sentenceSpan);
               } else {
                 const domIndex = chunk.domIndex !== undefined ? chunk.domIndex : chunk.index;
                 const scopeRoot = getScopeRoot();
                 let fallbackEl = scopeRoot.querySelector(\`[id="\${idPrefix}\${domIndex}"]\`);
                 if (!fallbackEl && idPrefix.startsWith("tts-explanation-")) {
                     fallbackEl = scopeRoot.querySelector(\`[id="\${idPrefix}0"]\`);
                 }
                 if (fallbackEl) {
                     doScroll(fallbackEl);
                 }
               }
            }`;

code = code.replace(targetScroll, replacementScroll);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
