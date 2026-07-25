const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const triggerStr = `    // Unlock audio context for mobile/safari
    try {
      const unlockAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      unlockAudio.play().catch(e => console.log('[ReadAloud] Unlock play caught:', e));
    } catch (e) {
      console.log('[ReadAloud] Audio context unlock error:', e);
    }`;

const newTriggerStr = `    // Unlock audio context for mobile/safari
    if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.style.display = 'none';
        document.body.appendChild(audioRef.current);
    }
    try {
      audioRef.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      audioRef.current.play().catch(e => console.log('[ReadAloud] Unlock play caught:', e));
    } catch (e) {
      console.log('[ReadAloud] Audio context unlock error:', e);
    }`;
content = content.replace(triggerStr, newTriggerStr);

const chunkPlayStr = `        const audio = new Audio(chunk.audioUrl);
        audio.playbackRate = playbackRate;
        audioRef.current = audio;
        
        console.log('[ReadAloud] Audio src length:', chunk.audioUrl?.length);
        console.log('[ReadAloud] Audio src starts with:', chunk.audioUrl?.substring(0, 50));
        
        audio.style.display = 'none';
        document.body.appendChild(audio);`;

const newChunkPlayStr = `        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.style.display = 'none';
            document.body.appendChild(audioRef.current);
        }
        const audio = audioRef.current;
        audio.playbackRate = playbackRate;
        audio.src = chunk.audioUrl;
        
        console.log('[ReadAloud] Audio src length:', chunk.audioUrl?.length);
        console.log('[ReadAloud] Audio src starts with:', chunk.audioUrl?.substring(0, 50));`;
content = content.replace(chunkPlayStr, newChunkPlayStr);

const removeChildStr = `           if (audio.parentElement) {
               audio.parentElement.removeChild(audio);
           }`;
content = content.replaceAll(removeChildStr, ''); // Remove all occurrences so we keep it in DOM

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Patched successfully");
