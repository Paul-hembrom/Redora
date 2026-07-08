import fs from 'fs';

let orchestrator = fs.readFileSync('server/lessonOrchestrator.ts', 'utf-8');

// 1. Change the model from gemini-3.1-flash-preview to gemini-2.5-flash
orchestrator = orchestrator.replace(
  'model: "gemini-3.1-flash-preview",',
  'model: "gemini-2.5-flash",'
);

// 2. Remove the try-catch with fallback in the synthesis loop
const loopRegex = /try \{\s*const url = await synthesizeElevenLabsSpeech\(ttsText\);\s*step\.narration_audio_url = url;\s*\} catch \(e\) \{\s*console\.warn\('ElevenLabs TTS failed, falling back to Gemini TTS'\);\s*const url = await synthesizeSpeech\(ttsText, 'Kore'\);\s*step\.narration_audio_url = url;\s*\}/g;

orchestrator = orchestrator.replace(loopRegex, `
        const url = await synthesizeElevenLabsSpeech(ttsText);
        step.narration_audio_url = url || null;
`);

// 3. Remove synthesizeSpeech import
orchestrator = orchestrator.replace(
  'import { synthesizeSpeech, synthesizeElevenLabsSpeech } from "../src/lib/gemini.js";',
  'import { synthesizeElevenLabsSpeech } from "../src/lib/gemini.js";'
);
orchestrator = orchestrator.replace(
  'import { synthesizeElevenLabsSpeech, synthesizeSpeech } from "../src/lib/gemini.js";',
  'import { synthesizeElevenLabsSpeech } from "../src/lib/gemini.js";'
);
orchestrator = orchestrator.replace(
  'import { synthesizeSpeech } from "../src/lib/gemini.js";',
  ''
);

fs.writeFileSync('server/lessonOrchestrator.ts', orchestrator);


let gemini = fs.readFileSync('src/lib/gemini.ts', 'utf-8');

const oldElevenLabsTTS = /export async function synthesizeElevenLabsSpeech\([\s\S]*?\}\n/g;
const newElevenLabsTTS = `
export async function synthesizeElevenLabsSpeech(text: string): Promise<string | null> {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('ELEVENLABS_API_KEY is not set');
      return null;
    }

    const voiceId = 'JwEIvMzFlLwrArLvqeM5'; // Katrina R - Real Estate Sales
    const modelId = 'eleven_v3';
    const url = \`https://api.elevenlabs.io/v1/text-to-speech/\${voiceId}\`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(\`ElevenLabs TTS API error: \${response.status}\`, errText);
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString('base64');
    return \`data:audio/mpeg;base64,\${base64}\`;
  } catch (err) {
    console.error('ElevenLabs TTS helper error:', err);
    return null;
  }
}
`;

if (gemini.includes('export async function synthesizeElevenLabsSpeech')) {
  gemini = gemini.replace(oldElevenLabsTTS, newElevenLabsTTS.trim() + '\\n');
} else {
  gemini = gemini + '\\n' + newElevenLabsTTS.trim() + '\\n';
}

fs.writeFileSync('src/lib/gemini.ts', gemini);
