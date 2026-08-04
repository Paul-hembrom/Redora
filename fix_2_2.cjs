const fs = require('fs');

let comp = fs.readFileSync('src/components/InteractiveLesson.tsx', 'utf-8');

const targetImport = `import { useState, useEffect, useRef } from 'react';`;
const newImport = `import { useState, useEffect, useRef } from 'react';`; // unchanged, just to check

const targetHook = `  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    if (lessonState === 'playing' && currentStep) {`;

const newHook = `  const currentStep = steps[currentStepIndex];
  const fetchingStepsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (currentStep && currentStep.narrationText && !currentStep.narration_audio_url && (!currentStep.narration_audio_chunks || currentStep.narration_audio_chunks.length === 0)) {
      if (fetchingStepsRef.current.has(currentStep.id)) return;
      fetchingStepsRef.current.add(currentStep.id);
      
      let active = true;
      (async () => {
         try {
            const res = await fetch('/api/tts/cartesia', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ text: currentStep.narrationText })
            });
            if (!res.ok || !res.body) throw new Error('TTS failed');
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            const chunks: {index: number, audioUrl: string}[] = [];
            
            while (active) {
               const { done, value } = await reader.read();
               if (done) break;
               buffer += decoder.decode(value, { stream: true });
               const lines = buffer.split('\\n');
               buffer = lines.pop() || '';
               for (const line of lines) {
                  if (line.trim()) {
                     try {
                        const data = JSON.parse(line);
                        if (data.audio) {
                           chunks.push({
                              index: data.index,
                              audioUrl: \`data:audio/wav;base64,\${data.audio}\`
                           });
                           setSteps(prev => {
                              const newSteps = [...prev];
                              const idx = newSteps.findIndex(s => s.id === currentStep.id);
                              if (idx !== -1) {
                                 newSteps[idx] = { ...newSteps[idx], narration_audio_chunks: [...chunks] };
                              }
                              return newSteps;
                           });
                        }
                     } catch(e) {}
                  }
               }
            }
         } catch(e) {
            console.error("Failed to fetch TTS:", e);
            // Mark as failed so fallback can take over by setting empty chunks array? No, wait, if empty array, fallback happens. But let's just leave it, fallback happens if length === 0.
            // Actually, wait, if we never set chunks, it stays undefined. 
            // We should set an empty array to trigger fallback immediately? No, fallback already triggers if undefined.
            // We should delay fallback until fetching is done?
         }
      })();
      
      return () => { active = false; };
    }
  }, [currentStep]);

  useEffect(() => {
    if (lessonState === 'playing' && currentStep) {`;

comp = comp.replace(targetHook, newHook);
fs.writeFileSync('src/components/InteractiveLesson.tsx', comp);
