const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// Remove smoothScrollTo, smoothScrollWindowTo, isInSafeZone
code = code.replace(/function smoothScrollTo[\s\S]*?function isInSafeZone[\s\S]*?\}\n\n/, '');

const targetScrollBlock = `            if (currentTime > 0.05 && lastScrolledSentenceIndexRef.current !== i) {
               lastScrolledSentenceIndexRef.current = i;

               const isFocusMode = localStorage.getItem('readora_focus_mode') === 'true';
               const focusSize = (localStorage.getItem('readora_focus_font_size') || '3xl').toLowerCase();
               const isLargeFont = isFocusMode && ['2xl', '3xl', '4xl', '5xl', '6xl'].includes(focusSize);

               const customScroll = (el: HTMLElement) => {
                 if (isLargeFont) {
                   const container = el.closest('.overflow-y-auto') || el.closest('.custom-scrollbar') as HTMLElement;
                   const floatingHeader = document.querySelector('.focus-mode-header') || document.querySelector('.z-\\\\[100\\\\]');
                   const stickyHeight = floatingHeader ? floatingHeader.getBoundingClientRect().height : 60;
                   
                   if (isInSafeZone(el, container as HTMLElement, stickyHeight, 0.35)) {
                       return;
                   }

                   const LINE_HEIGHT_CORRECTION: Record<string, number> = {
                     '2xl': 4, '3xl': 6, '4xl': 8, '5xl': 10, '6xl': 12,
                   };
                   const correction = LINE_HEIGHT_CORRECTION[focusSize] ?? 0;
                   const elRect = el.getBoundingClientRect();

                   if (container) {
                     const containerRect = container.getBoundingClientRect();
                     const target = container.scrollTop + (elRect.top - containerRect.top) - stickyHeight - 8 - correction;
                     smoothScrollTo(container as HTMLElement, target, 350);
                   } else {
                     const target = window.pageYOffset + elRect.top - stickyHeight - 8 - correction;
                     smoothScrollWindowTo(target, 350);
                   }
                 } else {
                   el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                 }
               };

               const sentenceSpan = document.getElementById(\`tts-sentence-\${i}\`);
               if (sentenceSpan) {
                 customScroll(sentenceSpan);
               } else {
                 const domIndex = chunk.domIndex !== undefined ? chunk.domIndex : chunk.index;
                 const scopeRoot = getScopeRoot();
                 let fallbackEl = scopeRoot.querySelector(\`[id="\${idPrefix}\${domIndex}"]\`) as HTMLElement;
                 if (!fallbackEl && idPrefix.startsWith("tts-explanation-")) {
                     fallbackEl = scopeRoot.querySelector(\`[id="\${idPrefix}0"]\`) as HTMLElement;
                 }
                 if (fallbackEl) {
                     customScroll(fallbackEl);
                 }
               }
            }`;

const replaceLogic = `            if (currentTime > 0.05 && lastScrolledSentenceIndexRef.current !== i) {
               lastScrolledSentenceIndexRef.current = i;

               const isFocusMode = localStorage.getItem('readora_focus_mode') === 'true';
               const focusSize = (localStorage.getItem('readora_focus_font_size') || '3xl').toLowerCase();
               const isLargeFont = isFocusMode && ['2xl', '3xl', '4xl', '5xl', '6xl'].includes(focusSize);

               const domIndex = chunk.domIndex !== undefined ? chunk.domIndex : chunk.index;
               window.dispatchEvent(new CustomEvent('tts-active-index', { 
                   detail: { idPrefix, index: domIndex, isLargeFont } 
               }));

               if (!isLargeFont) {
                   const sentenceSpan = document.getElementById(\`tts-sentence-\${i}\`);
                   if (sentenceSpan) {
                       sentenceSpan.scrollIntoView({ behavior: 'smooth', block: 'start' });
                   } else {
                       const scopeRoot = getScopeRoot();
                       let fallbackEl = scopeRoot.querySelector(\`[id="\${idPrefix}\${domIndex}"]\`) as HTMLElement;
                       if (!fallbackEl && idPrefix.startsWith("tts-explanation-")) {
                           fallbackEl = scopeRoot.querySelector(\`[id="\${idPrefix}0"]\`) as HTMLElement;
                       }
                       if (fallbackEl) {
                           fallbackEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                       }
                   }
               }
            }`;

code = code.replace(targetScrollBlock, replaceLogic);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
