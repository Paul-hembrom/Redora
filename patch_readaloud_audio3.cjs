const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

code = code.replace(
  "utterance.voice = englishVoice;\n          }\n          utterance.rate = 0.8;\n          }",
  "utterance.voice = englishVoice;\n          }\n          utterance.rate = 0.8;"
);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched ReadAloud 3');
