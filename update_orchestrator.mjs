import fs from 'fs';

let content = fs.readFileSync('server/lessonOrchestrator.ts', 'utf-8');

// Update imports
if (!content.includes('synthesizeElevenLabsSpeech')) {
  content = content.replace(
    'import { synthesizeSpeech } from "../src/lib/gemini.js";',
    'import { synthesizeSpeech, synthesizeElevenLabsSpeech } from "../src/lib/gemini.js";'
  );
}

const replacement = `
        let em = step.emotion || 'neutral';
        if (em === 'excited') em = 'enthusiastic';
        if (!ttsText.startsWith('[')) {
          ttsText = \`[\${em}] \${ttsText}\`;
        }
        
        try {
          const url = await synthesizeElevenLabsSpeech(ttsText);
          step.narration_audio_url = url;
        } catch (e) {
          console.warn('ElevenLabs TTS failed, falling back to Gemini TTS');
          const url = await synthesizeSpeech(ttsText, 'Kore');
          step.narration_audio_url = url;
        }
`;

content = content.replace(/let em = step\.emotion[\s\S]*?step\.narration_audio_url = url;/, replacement.trim());

fs.writeFileSync('server/lessonOrchestrator.ts', content);
