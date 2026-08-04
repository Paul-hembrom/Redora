const fs = require('fs');
let content = fs.readFileSync('src/components/InteractiveLesson.tsx', 'utf-8');

const targetStr = `      } else if (currentStep.type !== 'video' && !currentStep.narration_audio_url && (!currentStep.narration_audio_chunks || currentStep.narration_audio_chunks.length === 0)) {
        // Fallback for steps without audio, so it doesn't get stuck forever
        if (currentStep.type === 'question') {
          const timer = setTimeout(openAskScreen, 3000);
          return () => clearTimeout(timer);
        } else {
          const timer = setTimeout(handleAudioEnded, (currentStep.duration || 5) * 1000);
          return () => clearTimeout(timer);
        }
      }`;

const replacementStr = `      } else if (currentStep.type !== 'video' && !currentStep.narration_audio_url && (!currentStep.narration_audio_chunks || currentStep.narration_audio_chunks.length === 0)) {
        // Fallback for steps without audio
        if (currentStep.audio_unavailable) {
           // Wait for manual tap instead of auto-advance
           return;
        } else if (currentStep.type === 'question') {
          const timer = setTimeout(openAskScreen, 3000);
          return () => clearTimeout(timer);
        } else {
          const timer = setTimeout(handleAudioEnded, (currentStep.duration || 5) * 1000);
          return () => clearTimeout(timer);
        }
      }`;

content = content.replace(targetStr, replacementStr);

const noticeTarget = `          <div className={cn("mt-6 text-2xl leading-relaxed max-w-4xl font-medium tracking-tight text-center transition-all duration-300", lessonState === 'paused' ? 'opacity-40' : 'opacity-100')}>
            {currentStep?.narrationText || currentStep?.text}
          </div>`;

const noticeReplacement = `          <div className={cn("mt-6 text-2xl leading-relaxed max-w-4xl font-medium tracking-tight text-center transition-all duration-300", lessonState === 'paused' ? 'opacity-40' : 'opacity-100')}>
            {currentStep?.narrationText || currentStep?.text}
          </div>
          {currentStep?.audio_unavailable && (
            <div className="mt-4 px-4 py-2 bg-yellow-500/10 text-yellow-500 text-sm font-semibold rounded-full flex items-center justify-center cursor-pointer hover:bg-yellow-500/20 transition-colors" onClick={handleNext}>
              Audio unavailable. Tap to continue.
            </div>
          )}`;

content = content.replace(noticeTarget, noticeReplacement);

fs.writeFileSync('src/components/InteractiveLesson.tsx', content);
console.log("Fixed frontend fallback");
