const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldTrigger = `  const triggerSpeech = async () => {
    if (isPlaying || isLoading) {
      stopPlaying();
      return;
    }
    stopIntentRef.current = false;
    await tryElevenLabsTTS();
  };`;

const newTrigger = `  const triggerSpeech = async () => {
    if (isPlaying || isLoading) {
      stopPlaying();
      return;
    }
    stopIntentRef.current = false;
    
    // Play a short silent audio synchronously to unlock mobile Safari/Chrome autoplay
    try {
      const silentAudio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5LjI3LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWgAAAAgEEluZm8AAAAPAAAAEAAABCwADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAw//tQAAEQAAAABHAAAAAAAABHAAAAAAAD0AAAABHAAAAAAAABHAAAAAAAD0AAAAA=');
      silentAudio.play().catch(e => logWarning('Silent audio play failed, gesture might not be unlocked', e));
    } catch (e) {}

    await tryElevenLabsTTS();
  };`;

code = code.replace(oldTrigger, newTrigger);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched triggerSpeech');
