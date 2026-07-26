const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const target1 = `body: JSON.stringify({ text, highQuality })`;
const replacement1 = `body: JSON.stringify({ text, hq: highQuality })`;

const target2 = `  }, [text, isPlaying, isLoading, voicesAvailable]);`;
const replacement2 = `  }, [text, isPlaying, isLoading, voicesAvailable, highQuality]);`;

code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
