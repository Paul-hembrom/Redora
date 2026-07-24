const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const regex1 = /const audio = new Audio\(chunk\.audioUrl\);\n        audioRef\.current = audio;/s;
const replace1 = `const audio = new Audio();
        audio.playbackRate = 0.8;
        audio.src = chunk.audioUrl;
        audioRef.current = audio;`;

code = code.replace(regex1, replace1);

const regex2 = /const nextAudio = new Audio\(chunks\[i \+ 1\]\.audioUrl\);\n          nextAudio\.preload = "auto";/s;
const replace2 = `const nextAudio = new Audio();
          nextAudio.playbackRate = 0.8;
          nextAudio.src = chunks[i + 1].audioUrl;
          nextAudio.preload = "auto";`;

code = code.replace(regex2, replace2);

// Make sure any old timeupdate logic is completely gone and use 0.8 constant if needed
const regex3 = /audio\.playbackRate = playbackRate;/g;
code = code.replace(regex3, 'audio.playbackRate = 0.8;');

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("Patched ReadAloudButton.tsx");
