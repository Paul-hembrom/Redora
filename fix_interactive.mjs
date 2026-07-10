import fs from 'fs';

let content = fs.readFileSync('src/components/InteractiveLesson.tsx', 'utf-8');

const regex1 = /const currentStep = steps\[currentStepIndex\];/;
const repl1 = `const chunkIndexRef = useRef(0);
  useEffect(() => {
    chunkIndexRef.current = 0;
  }, [currentStepIndex]);

  const currentStep = steps[currentStepIndex];`;

content = content.replace(regex1, repl1);

const regex2 = /if \(currentStep\.narration_audio_url && audioRef\.current\) \{[\s\S]*?\} else if \(currentStep\.type !== 'video' && !currentStep\.narration_audio_url\) \{/;
const repl2 = `if (currentStep.narration_audio_chunks && currentStep.narration_audio_chunks.length > 0 && audioRef.current) {
        const chunkIndex = chunkIndexRef.current;
        if (chunkIndex < currentStep.narration_audio_chunks.length) {
          const chunkUrl = currentStep.narration_audio_chunks[chunkIndex].audioUrl;
          if (audioRef.current.getAttribute('src') !== chunkUrl) {
            audioRef.current.src = chunkUrl;
            
            if (chunkIndex + 1 < currentStep.narration_audio_chunks.length) {
                const preloadAudio = new Audio(currentStep.narration_audio_chunks[chunkIndex + 1].audioUrl);
                preloadAudio.preload = 'auto';
            }
          }
          audioRef.current.play().catch(e => console.error("Audio block:", e));
        }
      } else if (currentStep.narration_audio_url && audioRef.current) {
        if (audioRef.current.getAttribute('src') !== currentStep.narration_audio_url) {
          audioRef.current.src = currentStep.narration_audio_url;
        }
        audioRef.current.play().catch(e => console.error("Audio block:", e));
      } else if (currentStep.type !== 'video' && !currentStep.narration_audio_url && (!currentStep.narration_audio_chunks || currentStep.narration_audio_chunks.length === 0)) {`;

content = content.replace(regex2, repl2);

const regex3 = /const handleAudioEnded = \(\) => \{/;
const repl3 = `const handleAudioEnded = () => {
    if (currentStep && currentStep.narration_audio_chunks && chunkIndexRef.current + 1 < currentStep.narration_audio_chunks.length) {
        chunkIndexRef.current += 1;
        if (audioRef.current) {
            const nextUrl = currentStep.narration_audio_chunks[chunkIndexRef.current].audioUrl;
            audioRef.current.src = nextUrl;
            audioRef.current.play().catch(e => console.error("Audio chunk block:", e));
            
            if (chunkIndexRef.current + 1 < currentStep.narration_audio_chunks.length) {
                const preloadAudio = new Audio(currentStep.narration_audio_chunks[chunkIndexRef.current + 1].audioUrl);
                preloadAudio.preload = 'auto';
            }
        }
        return;
    }`;

content = content.replace(regex3, repl3);

fs.writeFileSync('src/components/InteractiveLesson.tsx', content);
console.log('done');
