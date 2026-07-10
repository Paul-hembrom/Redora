import fs from 'fs';

let content = fs.readFileSync('src/components/InteractiveLesson.tsx', 'utf-8');

// Line 514:
content = content.replace(
  /if \(currentStep\.narration_audio_url && audioRef\.current && !audioRef\.current\.ended\) \{/,
  `if (((currentStep.narration_audio_chunks && currentStep.narration_audio_chunks.length > 0) || currentStep.narration_audio_url) && audioRef.current && !audioRef.current.ended) {`
);

// Line 578:
content = content.replace(
  /\{!currentStep\.narration_audio_url && \(/,
  `{!(currentStep.narration_audio_url || (currentStep.narration_audio_chunks && currentStep.narration_audio_chunks.length > 0)) && (`
);

fs.writeFileSync('src/components/InteractiveLesson.tsx', content);
console.log('done');
