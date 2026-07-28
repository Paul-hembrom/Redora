const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const targetScroll = `  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };`;

const replacementScroll = `  const scrollToBottom = () => {
    if ((window as any)._chatScrollTimeout) {
      clearTimeout((window as any)._chatScrollTimeout);
    }
    (window as any)._chatScrollTimeout = setTimeout(() => {
      if (messagesEndRef.current) {
        const focusSize = focusFontSize ? focusFontSize.toLowerCase() : '3xl';
        const isLargeFont = isFocusMode && ['2xl', '3xl', '4xl', '5xl', '6xl'].includes(focusSize);
        console.log('ChatArea auto-scroll mode:', isLargeFont ? 'push-up' : 'scrollIntoView', 'font size:', focusSize);
        if (isLargeFont) {
          const rect = messagesEndRef.current.getBoundingClientRect();
          const absoluteTop = window.pageYOffset + rect.top;
          window.scrollTo({ top: absoluteTop - 8, behavior: 'smooth' });
        } else {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }, 50);
  };`;

code = code.replace(targetScroll, replacementScroll);
fs.writeFileSync('src/components/ChatArea.tsx', code);
