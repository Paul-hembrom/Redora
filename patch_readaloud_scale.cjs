const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const targetStr = `        let hasScrolled = false;
        let animationFrameId: number;

        const highlightLoop = () => {
            if (stopIntentRef.current || audio.paused || audio.ended) return;

            const currentTime = audio.currentTime;`;

const newStr = `        const scaleFactor = (chunk.rawDuration && chunk.playbackDuration) 
            ? (chunk.playbackDuration / chunk.rawDuration) 
            : (1 / playbackRate);
            
        const calibratedTimestamps = chunk.timestamps ? chunk.timestamps.map((item: any) => ({
            ...item,
            start: (item.start_time !== undefined ? item.start_time : item.start) * scaleFactor,
            end: (item.end_time !== undefined ? item.end_time : item.end) * scaleFactor
        })) : [];

        let hasScrolled = false;
        let animationFrameId: number;

        const highlightLoop = () => {
            if (stopIntentRef.current || audio.paused || audio.ended) return;

            const currentTime = audio.currentTime * scaleFactor;`;

content = content.replace(targetStr, newStr);

const chunkLoopStr = `            if (chunk.timestamps) {
                chunk.timestamps.forEach((ts: any, k: number) => {
                    let span = document.getElementById(\`tts-word-\${i}-\${k}\`);
                    if (!span) span = wordSpans[k];
                    if (!span) return;

                    const start_time = ts.start_time !== undefined ? ts.start_time : ts.start;
                    const end_time = ts.end_time !== undefined ? ts.end_time : ts.end;`;

const newChunkLoopStr = `            if (calibratedTimestamps.length > 0) {
                calibratedTimestamps.forEach((ts: any, k: number) => {
                    let span = document.getElementById(\`tts-word-\${i}-\${k}\`);
                    if (!span) span = wordSpans[k];
                    if (!span) return;

                    const start_time = ts.start;
                    const end_time = ts.end;`;

content = content.replace(chunkLoopStr, newChunkLoopStr);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Patched ReadAloudButton.tsx successfully");
