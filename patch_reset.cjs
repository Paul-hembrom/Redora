const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

code = code.replace(
  'const play = async () => {',
  'const play = async () => {\n    lastScrolledSentenceIndexRef.current = -1;'
);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
