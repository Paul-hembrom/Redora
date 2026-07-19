const fs = require('fs');
let code = fs.readFileSync('src/components/InteractiveLesson.tsx', 'utf8');

code = code.replace(/audioRef.current.play()/g, '(() => { audioRef.current.playbackRate = 0.8; return audioRef.current.play(); })()');
code = code.replace(/chatAudioRef.current.play()/g, '(() => { chatAudioRef.current.playbackRate = 0.8; return chatAudioRef.current.play(); })()');

fs.writeFileSync('src/components/InteractiveLesson.tsx', code);
console.log('patched IL audio');
