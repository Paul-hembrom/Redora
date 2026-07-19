const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const regex = /let highlightOverlay = document\.getElementById\('tts-highlight-overlay'\);[\s\S]*?audio\.onended = \(\) => \{\n           logInfo\(\`Chunk \$\{i\} ended\.\`\);\n           clearHighlightTimeouts\(\);\n           i\+\+;\n           isPlayingNext = false;\n           playNextChunk\(\);\n        \};/s;

const newCode = `        const wordSpans: (HTMLElement | null)[] = [];
        let shouldHighlight = true;

        // Remove old overlay if it exists
        const oldOverlay = document.getElementById('tts-highlight-overlay');
        if (oldOverlay) oldOverlay.remove();

        // Guard: Check if the text matches (to avoid erratic highlighting if chunks don't align)
        if (sentenceEl && chunk.text) {
           const domText = sentenceEl.textContent || '';
           if (domText.indexOf(chunk.text) === -1 && domText.toLowerCase().indexOf(chunk.text.toLowerCase()) === -1) {
               console.warn(\`Highlighting disabled for chunk \${i} because chunk text not found in DOM block\`);
               shouldHighlight = false;
           }
        }

        if (shouldHighlight && chunk.timestamps && chunk.timestamps.length > 0 && sentenceEl) {
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
            let chunkOffset = fullText.indexOf(chunk.text);
            if (chunkOffset === -1) chunkOffset = fullText.toLowerCase().indexOf(chunk.text.toLowerCase());
            if (chunkOffset !== -1) {
                searchIndex = chunkOffset;
            }

            for (const ts of chunk.timestamps) {
                const word = ts.word ? ts.word.trim() : "";
                if (!word) {
                    wordSpans.push(null);
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
                        
                        let span: HTMLElement | null = null;
                        // check if already wrapped
                        if (startNodeInfo.node === endNodeInfo.node && startNodeInfo.node.parentElement && startNodeInfo.node.parentElement.classList.contains('tts-word')) {
                            span = startNodeInfo.node.parentElement;
                        } else {
                            span = document.createElement('span');
                            span.className = 'tts-word transition-colors duration-100 ease-linear rounded';
                            try {
                                range.surroundContents(span);
                            } catch (e) {
                                span = null;
                            }
                        }
                        wordSpans.push(span);
                    } else {
                        wordSpans.push(null);
                    }
                    searchIndex = matchIdx + word.length;
                } else {
                    wordSpans.push(null);
                }
            }
        }

        const removeHighlights = () => {
            wordSpans.forEach(span => {
                if (span) span.classList.remove('bg-amber-400/70');
            });
        };

        const timeUpdateHandler = () => {
            if (stopIntentRef.current) return;
            const currentTime = audio.currentTime;

            chunk.timestamps.forEach((ts: any, k: number) => {
                const span = wordSpans[k];
                if (!span) return;

                const start_time = ts.start_time !== undefined ? ts.start_time : ts.start;
                const end_time = ts.end_time !== undefined ? ts.end_time : ts.end;

                let startAdjusted = start_time;
                let endAdjusted = end_time;
                if (i === 0) {
                    startAdjusted -= 0.150;
                    endAdjusted -= 0.150;
                }

                if (currentTime >= startAdjusted && currentTime < endAdjusted) {
                    span.classList.add('bg-amber-400/70');
                } else {
                    span.classList.remove('bg-amber-400/70');
                }
            });
        };

        audio.onplay = () => {
           logInfo(\`Chunk \${i} started playing.\`);
           if (!chunk.timestamps || stopIntentRef.current) return;
           audio.addEventListener('timeupdate', timeUpdateHandler);
        };

        audio.onpause = () => {
           logInfo(\`Chunk \${i} paused.\`);
           audio.removeEventListener('timeupdate', timeUpdateHandler);
           removeHighlights();
        };

        audio.onended = () => {
           logInfo(\`Chunk \${i} ended.\`);
           audio.removeEventListener('timeupdate', timeUpdateHandler);
           removeHighlights();
           i++;
           isPlayingNext = false;
           playNextChunk();
        };`;

code = code.replace(regex, newCode);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("Patched successfully.");
