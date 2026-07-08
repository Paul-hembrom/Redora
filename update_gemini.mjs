import fs from 'fs';

let content = fs.readFileSync('src/lib/gemini.ts', 'utf-8');

const newHelper = `
export async function synthesizeElevenLabsSpeech(text: string): Promise<string> {
  const baseUrl = typeof window !== 'undefined' ? '' : 'http://localhost:3000';
  const res = await fetch(\`\${baseUrl}/api/tts/elevenlabs\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error('ElevenLabs TTS failed');
  const data = await res.json();
  return data.audioUrl;
}

`;

content = content + '\n' + newHelper;
fs.writeFileSync('src/lib/gemini.ts', content);
