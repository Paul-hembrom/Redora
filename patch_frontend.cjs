const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const prewarmOld = `  useEffect(() => {
    const handleInteraction = () => {`;
const prewarmNew = `  useEffect(() => {
    fetch('/api/tts/elevenlabs/prewarm', { method: 'POST' }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleInteraction = () => {`;
code = code.replace(prewarmOld, prewarmNew);

const oldDomIndex = `        isPlayingNext = true;
        
        const sentenceEl = document.getElementById(\`\${idPrefix}\${i}\`);
        console.log(\`Scrolling to \${idPrefix}\${i}\`, 'found:', !!sentenceEl);`;
const newDomIndex = `        isPlayingNext = true;
        
        const domIndex = chunk.domIndex !== undefined ? chunk.domIndex : chunk.index;
        const sentenceEl = document.getElementById(\`\${idPrefix}\${domIndex}\`);
        console.log(\`Scrolling to \${idPrefix}\${domIndex}\`, 'found:', !!sentenceEl);`;
code = code.replace(oldDomIndex, newDomIndex);

const oldSearchIndex = `            let searchIndex = 0;
            for (const ts of chunk.timestamps) {`;
const newSearchIndex = `            let searchIndex = 0;
            let chunkOffset = fullText.indexOf(chunk.text);
            if (chunkOffset === -1) chunkOffset = fullText.toLowerCase().indexOf(chunk.text.toLowerCase());
            if (chunkOffset !== -1) {
                searchIndex = chunkOffset;
            }
            
            for (const ts of chunk.timestamps) {`;
code = code.replace(oldSearchIndex, newSearchIndex);

// Add the 150ms delay for the FIRST chunk
const oldDelay = `          // Small offset for the first chunk to align highlighting with audio start
          if (i === 0) {
            setTimeout(() => {
              if (!audio.paused) requestAnimationFrame(updateHighlights);
            }, 100);
            audio.onplay = null; // Prevent the default onplay from firing immediately
          }`;
const newDelay = `          // Small offset for the first chunk to align highlighting with audio start
          if (i === 0) {
            setTimeout(() => {
              if (!audio.paused) requestAnimationFrame(updateHighlights);
            }, 150);
            audio.onplay = null; // Prevent the default onplay from firing immediately
          }`;
code = code.replace(oldDelay, newDelay);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched frontend');
