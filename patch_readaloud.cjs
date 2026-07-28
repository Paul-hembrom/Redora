const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// 1. Add utility functions outside the component (top level)
const utilsCode = `
function smoothScrollTo(container: HTMLElement, target: number, duration = 350) {
  const from = container.scrollTop;
  const start = performance.now();

  function tick(now: number) {
    const elapsed = now - start;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    container.scrollTop = from + (target - from) * eased;
    if (t < 1) {
      requestAnimationFrame(tick);
    }
  }
  requestAnimationFrame(tick);
}

function smoothScrollWindowTo(target: number, duration = 350) {
  const from = window.pageYOffset;
  const start = performance.now();

  function tick(now: number) {
    const elapsed = now - start;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    window.scrollTo(0, from + (target - from) * eased);
    if (t < 1) {
      requestAnimationFrame(tick);
    }
  }
  requestAnimationFrame(tick);
}

function isInSafeZone(el: HTMLElement, container: HTMLElement | null, stickyHeight: number, zone = 0.35) {
  const r = el.getBoundingClientRect();
  if (container) {
    const c = container.getBoundingClientRect();
    const topBoundary = c.top + stickyHeight;
    const bottomBoundary = topBoundary + c.height * zone;
    return r.top >= topBoundary && r.top <= bottomBoundary;
  } else {
    const topBoundary = stickyHeight;
    const bottomBoundary = topBoundary + window.innerHeight * zone;
    return r.top >= topBoundary && r.top <= bottomBoundary;
  }
}
`;

code = code.replace(/import { cn } from '\.\.\/lib\/utils';/, "import { cn } from '../lib/utils';\n" + utilsCode);

// 2. Track sentence index with useRef inside the component
// Since we want to find where to add it, we can look for `const playSessionIdRef = useRef<number>(0);`
code = code.replace(
  'const playSessionIdRef = useRef<number>(0);',
  'const playSessionIdRef = useRef<number>(0);\n  const lastScrolledSentenceIndexRef = useRef<number>(-1);'
);

// 3. Modify `playNextChunk` or `highlightLoop`
// We'll replace the existing `if (currentTime > 0.05 && !hasScrolled)` block with a new approach,
// or we can just change the scroll trigger. The user said: 
// "In the ReadAloudButton, track the current sentence index... When the index changes... call custom scroll".
// Since `highlightLoop` runs every frame, we can do the check there, or better:
// we can just put the logic in `playNextChunk` or right where `hasScrolled` was.
// The existing code has `if (currentTime > 0.05 && !hasScrolled) { hasScrolled = true; ... }`
// which executes once per chunk. Since 1 chunk = 1 sentence in this component, `hasScrolled` effectively
// triggers once per sentence! But it triggers on *every* chunk if the font size is large.
// Let's replace the content of that block.

const targetScrollBlock = `            if (currentTime > 0.05 && !hasScrolled) {
               hasScrolled = true;

               const isFocusMode = localStorage.getItem('readora_focus_mode') === 'true';
               const focusSize = (localStorage.getItem('readora_focus_font_size') || '3xl').toLowerCase();
               const isLargeFont = isFocusMode && ['2xl', '3xl', '4xl', '5xl', '6xl'].includes(focusSize);
               console.log('Auto-scroll mode:', isLargeFont ? 'push-up' : 'scrollIntoView', 'font size:', focusSize);

               const debouncedScroll = (el: Element) => {
                 if ((window as any)._scrollTimeout) {
                   clearTimeout((window as any)._scrollTimeout);
                 }
                 (window as any)._scrollTimeout = setTimeout(() => {
                   if (isLargeFont) {
                     const rect = el.getBoundingClientRect();
                     const container = el.closest('.overflow-y-auto') || el.closest('.custom-scrollbar');
                     if (container) {
                       const containerRect = container.getBoundingClientRect();
                       const absoluteTop = container.scrollTop + (rect.top - containerRect.top);
                       container.scrollTo({ top: absoluteTop - 8, behavior: 'smooth' });
                     } else {
                       const absoluteTop = window.pageYOffset + rect.top;
                       window.scrollTo({ top: absoluteTop - 8, behavior: 'smooth' });
                     }
                   } else {
                     el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                   }
                 }, 50);
               };

               const sentenceSpan = document.getElementById(\`tts-sentence-\${i}\`);
               if (sentenceSpan) {
                 debouncedScroll(sentenceSpan);
               } else {
                 const domIndex = chunk.domIndex !== undefined ? chunk.domIndex : chunk.index;
                 const scopeRoot = getScopeRoot();
                 let fallbackEl = scopeRoot.querySelector(\`[id="\${idPrefix}\${domIndex}"]\`);
                 if (!fallbackEl && idPrefix.startsWith("tts-explanation-")) {
                     fallbackEl = scopeRoot.querySelector(\`[id="\${idPrefix}0"]\`);
                 }
                 if (fallbackEl) {
                     debouncedScroll(fallbackEl);
                 }
               }
            }`;

const replacementScrollBlock = `            if (currentTime > 0.05 && lastScrolledSentenceIndexRef.current !== i) {
               lastScrolledSentenceIndexRef.current = i;

               const isFocusMode = localStorage.getItem('readora_focus_mode') === 'true';
               const focusSize = (localStorage.getItem('readora_focus_font_size') || '3xl').toLowerCase();
               const isLargeFont = isFocusMode && ['2xl', '3xl', '4xl', '5xl', '6xl'].includes(focusSize);

               const customScroll = (el: HTMLElement) => {
                 if (isLargeFont) {
                   const container = el.closest('.overflow-y-auto') || el.closest('.custom-scrollbar') as HTMLElement;
                   const floatingHeader = document.querySelector('.focus-mode-header') || document.querySelector('.z-\\[100\\]');
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

code = code.replace(targetScrollBlock, replacementScrollBlock);
code = code.replace('let hasScrolled = false;', '');
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
