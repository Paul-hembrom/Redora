import fs from 'fs';

let content = fs.readFileSync('src/lib/gemini.ts', 'utf-8');

const regex = /export async function synthesizeElevenLabsSpeech\([\s\S]*?return \`data:audio\/mpeg;base64,\$\{base64\}\`;\n  \} catch \(err\) \{[\s\S]*?return null;\n  \}\n\}/;

const newLogic = `
function splitIntoSentences(text: string): string[] {
  const regex = /([^.!?]+[.!?]+)\\s*/g;
  let sentences: string[] = [];
  let match;
  let lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match[1].trim()) {
      sentences.push(match[1].trim());
    }
    lastIndex = regex.lastIndex;
  }
  const remaining = text.substring(lastIndex).trim();
  if (remaining) {
    sentences.push(remaining);
  }
  return sentences;
}

export async function synthesizeElevenLabsSpeech(text: string): Promise<any[] | null> {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('ELEVENLABS_API_KEY is not set');
      return null;
    }

    const voiceId = 'JwEIvMzFlLwrArLvqeM5'; // Katrina R
    const modelId = 'eleven_flash_v2_5';
    const url = \`https://api.elevenlabs.io/v1/text-to-speech/\${voiceId}?output_format=mp3_22050_32\`;

    const sentences = splitIntoSentences(text);
    
    const promises = sentences.map(async (sentence, index) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: sentence,
          model_id: modelId,
        }),
      });

      if (!response.ok) {
        throw new Error('TTS generation failed');
      }

      const audioBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(audioBuffer).toString('base64');
      return { index, audioUrl: \`data:audio/mpeg;base64,\${base64}\` };
    });

    const chunks = await Promise.all(promises);
    chunks.sort((a, b) => a.index - b.index);
    return chunks;
  } catch (err) {
    console.error('ElevenLabs TTS failed:', err);
    return null;
  }
}
`;

content = content.replace(regex, newLogic.trim());

fs.writeFileSync('src/lib/gemini.ts', content);
console.log('done');
