const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

code = code.replace(
  "if (audioRef.current) {",
  "const highlightOverlay = document.getElementById('tts-highlight-overlay');\n    if (highlightOverlay) highlightOverlay.style.opacity = '0';\n    if (audioRef.current) {"
);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched stopPlaying');
