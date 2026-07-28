const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const targetScroll = `               const doScroll = (el: Element) => {
                 if (isLargeFont) {
                   const rect = el.getBoundingClientRect();
                   if (rect.top > 0) {
                     window.scrollBy({ top: rect.top - 8, behavior: 'smooth' });
                   }
                 } else {
                   el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                 }
               };`;

const replacementScroll = `               const doScroll = (el: Element) => {
                 if (isLargeFont) {
                   const rect = el.getBoundingClientRect();
                   const container = el.closest('.overflow-y-auto') || el.closest('.custom-scrollbar');
                   if (container) {
                     const containerRect = container.getBoundingClientRect();
                     const offset = rect.top - containerRect.top;
                     container.scrollBy({ top: offset - 8, behavior: 'smooth' });
                   } else {
                     window.scrollBy({ top: rect.top - 8, behavior: 'smooth' });
                   }
                 } else {
                   el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                 }
               };`;

code = code.replace(targetScroll, replacementScroll);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
