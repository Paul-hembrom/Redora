const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const targetScroll = `               const debouncedScroll = (el: Element) => {
                 if ((window as any)._scrollTimeout) {
                   clearTimeout((window as any)._scrollTimeout);
                 }
                 (window as any)._scrollTimeout = setTimeout(() => {
                   if (isLargeFont) {
                     const rect = el.getBoundingClientRect();
                     const absoluteTop = window.pageYOffset + rect.top;
                     window.scrollTo({ top: absoluteTop - 8, behavior: 'smooth' });
                   } else {
                     el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                   }
                 }, 50);
               };`;

const replacementScroll = `               const debouncedScroll = (el: Element) => {
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
               };`;

code = code.replace(targetScroll, replacementScroll);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
