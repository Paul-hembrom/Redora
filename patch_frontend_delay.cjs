const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldDelay = `               // Calculate delay considering current playback time and playback rate
               const startDelay = Math.max(0, (start_time - audio.currentTime)) * 1000 / playbackRate;
               const endDelay = Math.max(0, (end_time - audio.currentTime)) * 1000 / playbackRate;`;

const newDelay = `               // Calculate delay considering current playback time and playback rate
               let startDelay = Math.max(0, (start_time - audio.currentTime)) * 1000 / playbackRate;
               let endDelay = Math.max(0, (end_time - audio.currentTime)) * 1000 / playbackRate;
               
               // Apply 150ms offset for the very first chunk to compensate for encoder delay
               if (i === 0) {
                   startDelay += 150;
                   endDelay += 150;
               }`;

code = code.replace(oldDelay, newDelay);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched frontend delay');
