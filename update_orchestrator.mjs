import fs from 'fs';

let content = fs.readFileSync('server/lessonOrchestrator.ts', 'utf-8');

const regex = /const url = await synthesizeElevenLabsSpeech\(ttsText\);\n        step.narration_audio_url = url \|\| null;/;

const newLogic = `
        const chunks = await synthesizeElevenLabsSpeech(ttsText);
        if (chunks && chunks.length > 0) {
          step.narration_audio_chunks = chunks;
          step.narration_audio_url = chunks[0].audioUrl; // fallback
        } else {
          step.narration_audio_url = null;
        }
`;

content = content.replace(regex, newLogic.trim());

fs.writeFileSync('server/lessonOrchestrator.ts', content);
console.log('done');
