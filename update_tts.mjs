import fs from 'fs';

let serverTs = fs.readFileSync('server.ts', 'utf-8');

const oldEndpointStart = "app.post('/api/tts/elevenlabs', async (req, res) => {";
const newEndpoint = `
function splitIntoSentences(text) {
  // Split on . ! ? followed by whitespace, keeping the punctuation
  const regex = /([^.!?]+[.!?]+)\\s*/g;
  let sentences = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1].trim()) {
      sentences.push(match[1].trim());
    }
  }
  // Fallback if no punctuation
  if (sentences.length === 0 && text.trim()) {
    sentences.push(text.trim());
  }
  return sentences;
}

app.post('/api/tts/elevenlabs', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Missing text' });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('ELEVENLABS_API_KEY is not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const voiceId = 'JwEIvMzFlLwrArLvqeM5'; // Katrina R
    const modelId = 'eleven_flash_v2_5';
    // Reduce output format to mp3_22050_32
    const url = \`https://api.elevenlabs.io/v1/text-to-speech/\${voiceId}?output_format=mp3_22050_32\`;

    const sentences = splitIntoSentences(text);
    
    // Fetch all chunks in parallel
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
        const errText = await response.text();
        console.error(\`ElevenLabs TTS API error: \${response.status}\`, errText);
        throw new Error('TTS generation failed');
      }

      const audioBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(audioBuffer).toString('base64');
      const audioUrl = \`data:audio/mpeg;base64,\${base64}\`;
      
      return { index, audioUrl };
    });

    const chunks = await Promise.all(promises);
    
    // Sort just in case Promise.all returned out of order (though map preserves order, index is good for safety)
    chunks.sort((a, b) => a.index - b.index);

    res.json({ chunks });
  } catch (err) {
    console.error('ElevenLabs TTS endpoint error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
`;

const startIndex = serverTs.indexOf(oldEndpointStart);
const endIndex = serverTs.indexOf("app.post('/api/tts'", startIndex);
serverTs = serverTs.substring(0, startIndex) + newEndpoint + serverTs.substring(endIndex);

fs.writeFileSync('server.ts', serverTs);
console.log('done');
