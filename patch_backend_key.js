import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(`    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('ELEVENLABS_API_KEY is not set');
      return res.status(500).json({ error: 'ElevenLabs API key missing' });
    }`, "");

// Add it to the fallback logic
const fallbackStart = "console.error('Kokoro stream TTS failed, falling back to original pipeline:', kokoroErr.message);";
const fallbackKey = `
    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('ELEVENLABS_API_KEY is not set');
      return res.status(500).json({ error: 'ElevenLabs API key missing' });
    }
`;

content = content.replace(fallbackStart, fallbackStart + '\\n' + fallbackKey);
fs.writeFileSync('server.ts', content);
