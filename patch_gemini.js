const fs = require('fs');

const filePath = 'src/lib/gemini.ts';
let code = fs.readFileSync(filePath, 'utf8');

const importStatement = `import { getCachedTtsAudio, cacheTtsAudio } from './offline';\n`;
if (!code.includes('getCachedTtsAudio')) {
  code = importStatement + code;
}

const elevenlabsTtsCode = `
export async function elevenlabsTTS(text: string, voiceId: string = "21m00Tcm4TlvDq8ikWAM"): Promise<string> {
  const apiKey = getApiKey(EL_KEY);
  if (!apiKey) throw new Error('ElevenLabs API key required for TTS');
  
  // Check cache first
  const cachedUrl = await getCachedTtsAudio(text);
  if (cachedUrl) return cachedUrl;

  const response = await fetch(\`https://api.elevenlabs.io/v1/text-to-speech/\${voiceId}?output_format=mp3_44100_128\`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_v3',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    })
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(\`ElevenLabs TTS failed: \${err}\`);
  }
  
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  
  // Cache it
  await cacheTtsAudio(text, dataUrl);
  
  return dataUrl;
}
`;

if (!code.includes('elevenlabsTTS')) {
  code = code.replace('export async function synthesizeSpeech', elevenlabsTtsCode + '\nexport async function synthesizeSpeech');
}

fs.writeFileSync(filePath, code, 'utf8');
