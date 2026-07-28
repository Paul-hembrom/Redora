const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const targetScroll = `               const doScroll = (el: Element) => {
                 if (isLargeFont) {
                   const rect = el.getBoundingClientRect();
                   const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                   const targetY = rect.top + scrollTop - 20;
                   window.scrollTo({ top: targetY, behavior: 'smooth' });
                 } else {
                   el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                 }
               };`;

const replacementScroll = `               const doScroll = (el: Element) => {
                 if (isLargeFont) {
                   const rect = el.getBoundingClientRect();
                   if (rect.top > 0) {
                     window.scrollBy({ top: rect.top - 8, behavior: 'smooth' });
                   }
                 } else {
                   el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                 }
               };`;

code = code.replace(targetScroll, replacementScroll);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
