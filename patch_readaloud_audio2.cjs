const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// replace the first block
code = code.replace(
  "utterance.voice = englishVoice;\n      utterance.rate = 0.8;",
  "utterance.voice = englishVoice;\n          }\n          utterance.rate = 0.8;"
);

// replace the second block
code = code.replace(
  "utterance.voice = englishVoice;\n      utterance.rate = 0.8;\n      logSuccess",
  "utterance.voice = englishVoice;\n      logSuccess"
);

code = code.replace(
  "    let didEnd = false;",
  "    utterance.rate = 0.8;\n    let didEnd = false;"
);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched ReadAloud 2');
