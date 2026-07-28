const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

code = code.replace(
  'const stopPlaying = () => {',
  'const stopPlaying = () => {\n    window.dispatchEvent(new CustomEvent("tts-active-index", { detail: { idPrefix, index: -1, isLargeFont: true } }));'
);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
