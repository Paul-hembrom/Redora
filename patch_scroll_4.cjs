const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const targetScroll = `               const isFocusMode = localStorage.getItem('readora_focus_mode') === 'true';
               const focusSize = (localStorage.getItem('readora_focus_font_size') || 'xl').toLowerCase();
               const isLargeFont = isFocusMode && ['2xl', '3xl', '4xl', '5xl', '6xl'].includes(focusSize);
               console.log('Auto-scroll mode:', isLargeFont ? 'push-up' : 'scrollIntoView', 'font size:', focusSize);

               const doScroll = (el: Element) => {
                 if (isLargeFont) {
                   const rect = el.getBoundingClientRect();
                   if (rect.top > 0) {
                     window.scrollBy({ top: rect.top - 8, behavior: 'smooth' });
                   }
                 } else {
                   el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                 }
               };`;

const replacementScroll = `               const isFocusMode = localStorage.getItem('readora_focus_mode') === 'true';
               const focusSize = (localStorage.getItem('readora_focus_font_size') || '3xl').toLowerCase();
               const isLargeFont = isFocusMode && ['2xl', '3xl', '4xl', '5xl', '6xl'].includes(focusSize);
               console.log('Auto-scroll mode:', isLargeFont ? 'push-up' : 'scrollIntoView', 'font size:', focusSize);

               const doScroll = (el: Element) => {
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

// Also patch App.tsx default font size
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(
  "const [focusFontSize, setFocusFontSize] = useState(() => localStorage.getItem('readora_focus_font_size') || 'xl');",
  "const [focusFontSize, setFocusFontSize] = useState(() => localStorage.getItem('readora_focus_font_size') || '3xl');"
);
fs.writeFileSync('src/App.tsx', appCode);

