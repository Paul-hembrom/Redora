const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const targetScroll = `        if (isLargeFont) {
          const rect = messagesEndRef.current.getBoundingClientRect();
          const absoluteTop = window.pageYOffset + rect.top;
          window.scrollTo({ top: absoluteTop - 8, behavior: 'smooth' });
        } else {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }`;

const replacementScroll = `        if (isLargeFont) {
          const rect = messagesEndRef.current.getBoundingClientRect();
          const container = messagesEndRef.current.closest('.overflow-y-auto') || messagesEndRef.current.closest('.custom-scrollbar');
          if (container) {
            const containerRect = container.getBoundingClientRect();
            const absoluteTop = container.scrollTop + (rect.top - containerRect.top);
            container.scrollTo({ top: absoluteTop - 8, behavior: 'smooth' });
          } else {
            const absoluteTop = window.pageYOffset + rect.top;
            window.scrollTo({ top: absoluteTop - 8, behavior: 'smooth' });
          }
        } else {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }`;

code = code.replace(targetScroll, replacementScroll);
fs.writeFileSync('src/components/ChatArea.tsx', code);
