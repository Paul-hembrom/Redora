const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// 1. Add useEffect for playbackRate
const regexUseEffect = /  const showError = \(msg: string\) => \{/;
const replUseEffect = `  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const showError = (msg: string) => {`;
content = content.replace(regexUseEffect, replUseEffect);

// 2. Add syncTime to highlightLoop
const regexHighlight = /const currentTime = audio\.currentTime;\s*if \(currentTime > 0\.05 && !hasScrolled\)/;
const replHighlight = `const currentTime = audio.currentTime;
            const syncTime = currentTime / 0.8;
            
            if (currentTime > 0.05 && !hasScrolled)`;
content = content.replace(regexHighlight, replHighlight);

// 3. Update comparison to use syncTime
const regexCompare = /if \(currentTime >= startAdjusted && currentTime < endAdjusted\) \{[\s\S]*?const duration = endAdjusted - startAdjusted;\s*const progress = duration > 0 \? Math\.max\(0, Math\.min\(1, \(currentTime - startAdjusted\) \/ duration\)\) : 1;/;
const replCompare = `if (syncTime >= startAdjusted && syncTime < endAdjusted) {
                        const duration = endAdjusted - startAdjusted;
                        const progress = duration > 0 ? Math.max(0, Math.min(1, (syncTime - startAdjusted) / duration)) : 1;`;
content = content.replace(regexCompare, replCompare);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Patched ReadAloudButton successfully");
