const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const playStr = `        const audio = new Audio();
        audio.playbackRate = playbackRate;
        audio.src = chunk.audioUrl;
        audioRef.current = audio;
        
        console.log('[ReadAloud] Audio element created – src length:', chunk.audioUrl?.length);
        console.log('[ReadAloud] Audio src starts with:', chunk.audioUrl?.substring(0, 50));
        
        audio.style.display = 'none';
        document.body.appendChild(audio);

        audio.onloadedmetadata = () => console.log('[ReadAloud] Audio duration:', audio.duration);`;

const newPlayStr = `        const audio = new Audio(chunk.audioUrl);
        audio.playbackRate = playbackRate;
        audioRef.current = audio;
        
        console.log('[ReadAloud] Audio src length:', chunk.audioUrl?.length);
        console.log('[ReadAloud] Audio src starts with:', chunk.audioUrl?.substring(0, 50));
        
        audio.style.display = 'none';
        document.body.appendChild(audio);

        audio.onloadedmetadata = () => console.log('[ReadAloud] Audio duration:', audio.duration);`;

content = content.replace(playStr, newPlayStr);

const audioOnplay = `        audio.onplay = () => {
           console.log('[ReadAloud] Audio playing');`;
const newAudioOnplay = `        audio.onplay = () => {
           console.log('[ReadAloud] Audio onplay fired');`;
content = content.replace(audioOnplay, newAudioOnplay);

const audioOnpause = `        audio.onpause = () => {
           console.log('[ReadAloud] Audio paused');`;
const newAudioOnpause = `        audio.onpause = () => {
           console.log('[ReadAloud] Audio onpause fired');`;
content = content.replace(audioOnpause, newAudioOnpause);

const audioOnended = `        audio.onended = () => {
           console.log('[ReadAloud] Audio ended');`;
const newAudioOnended = `        audio.onended = () => {
           console.log('[ReadAloud] Audio onended fired');`;
content = content.replace(audioOnended, newAudioOnended);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
