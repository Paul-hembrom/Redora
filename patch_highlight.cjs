const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf-8');

const oldLogic = `        // 1. ADD THIS: Separate initial sentence scroll state from active word scroll state
        let hasScrolledInitial = false;
        let lastActiveSpan: HTMLElement | null = null;

        const highlightLoop = () => {
            if (currentSessionId !== playSessionIdRef.current || audio.paused || audio.ended) return;
            const currentTime = audio.currentTime;
            
            // 2. CHANGE THIS: Initial jump to ensure the start of the sentence is on screen
            if (currentTime > 0.05 && !hasScrolledInitial) {
               hasScrolledInitial = true;
               const scrollTarget: HTMLElement | null = wordSpans[0] || sentenceEl;
               if (scrollTarget) {
                 const rect = scrollTarget.getBoundingClientRect();
                 const margin = 80;
                 const alreadyVisible = rect.top >= margin && rect.bottom <= window.innerHeight - margin;
                 if (!alreadyVisible) {
                   scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 }
               }
            }

            if (chunk.timestamps && chunk.timestamps.length > 0) {
                chunk.timestamps.forEach((ts: any, k: number) => {
                    let span = document.getElementById(\`tts-word-\${i}-\${k}\`);
                    if (!span) span = wordSpans[k];
                    if (!span) return;
                    
                    const start_time = ts.start_time !== undefined ? ts.start_time : ts.start;
                    const end_time = ts.end_time !== undefined ? ts.end_time : ts.end;
                    
                    let startAdjusted = start_time;
                    let endAdjusted = end_time;

                    if (currentTime >= startAdjusted && currentTime < endAdjusted) {
                        const duration = endAdjusted - startAdjusted;
                        const progress = duration > 0 ? Math.max(0, Math.min(1, (currentTime - startAdjusted) / duration)) : 1;
                        span.style.background = \`linear-gradient(to right, #FBBF24 \${progress * 100}%, transparent \${progress * 100}%)\`;
                        span.style.webkitBackgroundClip = 'text';
                        span.style.backgroundClip = 'text';
                        span.style.color = 'transparent';
                        span.classList.remove('bg-amber-400/70');
                        
                        // 3. ADD THIS: Active Tracking (The crucial fix for 3xl / Smartboards)
                        // If the word changes, check if it's falling off screen and recenter
                        if (span !== lastActiveSpan) {
                            lastActiveSpan = span;
                            const rect = span.getBoundingClientRect();
                            const margin = 120; // Generous margin for 3xl text
                            
                            // If the actively read word is too close to the top or bottom edges, recenter it dynamically
                            if (rect.bottom > window.innerHeight - margin || rect.top < margin) {
                                span.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }
                    } else {
                        span.style.background = '';
                        span.style.webkitBackgroundClip = '';
                        span.style.backgroundClip = '';
                        span.style.color = '';
                        span.classList.remove('bg-amber-400/70');
                    }
                });
            }
            
            animationFrameIdRef.current = requestAnimationFrame(highlightLoop);
        };`;

const newLogic = `        // 1. ADD THIS: Separate initial sentence scroll state from active word scroll state
        let hasScrolledInitial = false;
        let lastActiveSpan: HTMLElement | null = null;

        // Group timestamps by span to fill gaps (e.g. LLM normalized math symbols that don't match DOM text)
        const spanTimings = new Map<HTMLElement, { start: number, end: number }>();
        if (chunk.timestamps && chunk.timestamps.length > 0) {
            let currentSpan: HTMLElement | null = null;
            for (let k = 0; k < chunk.timestamps.length; k++) {
                const ts = chunk.timestamps[k];
                const start = ts.start_time !== undefined ? ts.start_time : ts.start;
                const end = ts.end_time !== undefined ? ts.end_time : ts.end;
                
                let span = document.getElementById(\`tts-word-\${i}-\${k}\`);
                if (!span) span = wordSpans[k];
                
                if (span) {
                    currentSpan = span;
                    if (!spanTimings.has(span)) {
                        spanTimings.set(span, { start, end });
                    } else {
                        const timing = spanTimings.get(span)!;
                        timing.end = Math.max(timing.end, end);
                    }
                } else if (currentSpan) {
                    // Extend the current span's time to cover this unmatched timestamp
                    const timing = spanTimings.get(currentSpan)!;
                    timing.end = Math.max(timing.end, end);
                }
            }
        }

        const highlightLoop = () => {
            if (currentSessionId !== playSessionIdRef.current || audio.paused || audio.ended) return;
            const currentTime = audio.currentTime;
            
            // 2. CHANGE THIS: Initial jump to ensure the start of the sentence is on screen
            if (currentTime > 0.05 && !hasScrolledInitial) {
               hasScrolledInitial = true;
               const scrollTarget: HTMLElement | null = wordSpans[0] || sentenceEl;
               if (scrollTarget) {
                 const rect = scrollTarget.getBoundingClientRect();
                 const margin = 80;
                 const alreadyVisible = rect.top >= margin && rect.bottom <= window.innerHeight - margin;
                 if (!alreadyVisible) {
                   scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 }
               }
            }

            spanTimings.forEach((timing, span) => {
                const { start: startAdjusted, end: endAdjusted } = timing;
                
                if (currentTime >= startAdjusted && currentTime < endAdjusted) {
                    const duration = endAdjusted - startAdjusted;
                    const progress = duration > 0 ? Math.max(0, Math.min(1, (currentTime - startAdjusted) / duration)) : 1;
                    span.style.background = \`linear-gradient(to right, #FBBF24 \${progress * 100}%, transparent \${progress * 100}%)\`;
                    span.style.webkitBackgroundClip = 'text';
                    span.style.backgroundClip = 'text';
                    span.style.color = 'transparent';
                    span.classList.remove('bg-amber-400/70');
                    
                    // 3. ADD THIS: Active Tracking (The crucial fix for 3xl / Smartboards)
                    // If the word changes, check if it's falling off screen and recenter
                    if (span !== lastActiveSpan) {
                        lastActiveSpan = span;
                        const rect = span.getBoundingClientRect();
                        const margin = 120; // Generous margin for 3xl text
                        
                        // If the actively read word is too close to the top or bottom edges, recenter it dynamically
                        if (rect.bottom > window.innerHeight - margin || rect.top < margin) {
                            span.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }
                } else {
                    span.style.background = '';
                    span.style.webkitBackgroundClip = '';
                    span.style.backgroundClip = '';
                    span.style.color = '';
                    span.classList.remove('bg-amber-400/70');
                }
            });
            
            animationFrameIdRef.current = requestAnimationFrame(highlightLoop);
        };`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
