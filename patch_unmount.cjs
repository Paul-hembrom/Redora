const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const targetStr = `return () => {
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };`;

const replacementStr = `return () => {
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('click', handleInteraction);
      const highlightOverlay = document.getElementById('tts-highlight-overlay');
      if (highlightOverlay) highlightOverlay.style.opacity = '0';
    };`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched unmount');
