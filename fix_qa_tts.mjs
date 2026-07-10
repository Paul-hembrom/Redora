import fs from 'fs';

let content = fs.readFileSync('src/components/InteractiveLesson.tsx', 'utf-8');

const regex = /\/\/ Trigger TTS for AI response[\s\S]*?\} catch \(err\) \{/g;

const newLogic = `
       // Trigger TTS for AI response
       try {
         const ttsRes = await fetch('/api/tts/elevenlabs', {
           method: 'POST',
           credentials: 'include',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ text: aiResponseText })
         });
         
         if (ttsRes.ok) {
           const data = await ttsRes.json();
           if (data.chunks && data.chunks.length > 0 && chatAudioRef.current) {
             const playQAQueue = async (chunks, index) => {
               if (index >= chunks.length) return;
               const qaAudio = new Audio(chunks[index].audioUrl);
               
               if (index + 1 < chunks.length) {
                 const nextAudio = new Audio(chunks[index + 1].audioUrl);
                 nextAudio.preload = 'auto';
               }
               
               qaAudio.onended = () => {
                 playQAQueue(chunks, index + 1);
               };
               
               try {
                 await qaAudio.play();
                 setChatAudioPlaying(true);
               } catch (e) {
                 console.error("QA chunk play error", e);
                 setChatAudioPlaying(false);
               }
             };
             playQAQueue(data.chunks, 0);
           }
         }
       } catch (err) {
`;

content = content.replace(regex, newLogic.trim() + " catch (err) {");

fs.writeFileSync('src/components/InteractiveLesson.tsx', content);
console.log('done');
