const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const targetScroll = `               const isFocusMode = localStorage.getItem('readora_focus_mode') === 'true';
               const focusSize = localStorage.getItem('readora_focus_font_size') || 'xl';
               const isLargeFont = isFocusMode && ['3xl', '4xl', '5xl', '6xl'].includes(focusSize);`;

const replacementScroll = `               const isFocusMode = localStorage.getItem('readora_focus_mode') === 'true';
               const focusSize = (localStorage.getItem('readora_focus_font_size') || 'xl').toLowerCase();
               const isLargeFont = isFocusMode && ['2xl', '3xl', '4xl', '5xl', '6xl'].includes(focusSize);
               console.log('Auto-scroll mode:', isLargeFont ? 'push-up' : 'scrollIntoView', 'font size:', focusSize);`;

code = code.replace(targetScroll, replacementScroll);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
