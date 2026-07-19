const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// We'll replace the block from "const audio = new Audio(chunk.audioUrl);" to "audio.onended = () => {"
const targetStr = `const audio = new Audio(chunk.audioUrl);
        audioRef.current = audio;
        
        if (i + 1 < chunks.length && chunks[i+1].audioUrl) {
          const nextAudio = new Audio(chunks[i+1].audioUrl);
          nextAudio.preload = "auto";
        }
        
        audio.onended = () => {`;

const replacementStr = `const audio = new Audio(chunk.audioUrl);
        audioRef.current = audio;
        
        if (i + 1 < chunks.length && chunks[i+1].audioUrl) {
          const nextAudio = new Audio(chunks[i+1].audioUrl);
          nextAudio.preload = "auto";
        }
        
        let highlightOverlay = document.getElementById('tts-highlight-overlay');
        if (!highlightOverlay) {
            highlightOverlay = document.createElement('div');
            highlightOverlay.id = 'tts-highlight-overlay';
            highlightOverlay.className = 'absolute pointer-events-none bg-yellow-400/30 dark:bg-yellow-200/20 rounded z-[100] transition-all duration-75 ease-linear';
            document.body.appendChild(highlightOverlay);
        }
        
        const ranges: (Range | null)[] = [];
        if (chunk.timestamps && chunk.timestamps.length > 0 && sentenceEl) {
            const walker = document.createTreeWalker(sentenceEl, NodeFilter.SHOW_TEXT, null);
            const textNodes = [];
            let node;
            while ((node = walker.nextNode())) {
                textNodes.push(node);
            }
            
            let fullText = "";
            const indexMap: {node: Node, offset: number}[] = [];
            for (const tNode of textNodes) {
                const txt = tNode.nodeValue || "";
                for (let k = 0; k < txt.length; k++) {
                    indexMap.push({ node: tNode, offset: k });
                }
                fullText += txt;
            }
            
            let searchIndex = 0;
            for (const ts of chunk.timestamps) {
                const word = ts.word ? ts.word.trim() : "";
                if (!word) {
                    ranges.push(null);
                    continue;
                }
                let matchIdx = fullText.indexOf(word, searchIndex);
                if (matchIdx === -1) {
                    matchIdx = fullText.toLowerCase().indexOf(word.toLowerCase(), searchIndex);
                }
                if (matchIdx !== -1) {
                    const startNodeInfo = indexMap[matchIdx];
                    const endNodeInfo = indexMap[matchIdx + word.length - 1];
                    if (startNodeInfo && endNodeInfo) {
                        const range = document.createRange();
                        range.setStart(startNodeInfo.node, startNodeInfo.offset);
                        range.setEnd(endNodeInfo.node, endNodeInfo.offset + 1);
                        ranges.push(range);
                    } else {
                        ranges.push(null);
                    }
                    searchIndex = matchIdx + word.length;
                } else {
                    ranges.push(null);
                }
            }
        }
        
        const updateHighlights = () => {
           if (audio !== audioRef.current || stopIntentRef.current || audio.paused || audio.ended) {
               if (highlightOverlay) highlightOverlay.style.opacity = '0';
               return;
           }
           const currentTime = audio.currentTime;
           let activeRange = null;
           if (chunk.timestamps && chunk.timestamps.length > 0) {
               for (let k = 0; k < chunk.timestamps.length; k++) {
                   const ts = chunk.timestamps[k];
                   if (currentTime >= ts.start && currentTime <= ts.end) {
                       activeRange = ranges[k];
                       break;
                   }
               }
           }
           if (activeRange && highlightOverlay) {
               const rect = activeRange.getBoundingClientRect();
               highlightOverlay.style.top = \`\${rect.top + window.scrollY}px\`;
               highlightOverlay.style.left = \`\${rect.left + window.scrollX}px\`;
               highlightOverlay.style.width = \`\${rect.width}px\`;
               highlightOverlay.style.height = \`\${rect.height}px\`;
               highlightOverlay.style.opacity = '1';
           } else if (highlightOverlay) {
               highlightOverlay.style.opacity = '0';
           }
           requestAnimationFrame(updateHighlights);
        };
        
        audio.onplay = () => requestAnimationFrame(updateHighlights);
        
        audio.onended = () => {`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched frontend');
