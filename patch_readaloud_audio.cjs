const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

code = code.replace(/await audio.play\(\);/g, 'audio.playbackRate = 0.8;\n        await audio.play();');
code = code.replace(/utterance.voice = englishVoice;/g, 'utterance.voice = englishVoice;\n      utterance.rate = 0.8;');

// Double check the utterance.rate setting if there are multiple places
code = code.replace(/utterance.voice = englishVoice;\n          }/g, 'utterance.voice = englishVoice;\n          }\n          utterance.rate = 0.8;');

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched ReadAloud');
