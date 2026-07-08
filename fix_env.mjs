import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

content = content.replace(
  "const apiKey = process.env.ELEVENLABS_API_KEY;\n    if (!apiKey) {\n      console.error('ELEVENLABS_API_KEY is not set');",
  "const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;\n    if (!apiKey) {\n      console.error('ELEVENLABS_API_KEY is not set');"
);

content = content.replace(
  "const apiKey = process.env.ELEVENLABS_API_KEY;\n    if (!apiKey) {\n      return res.status(500).json({ error: \"Missing ELEVENLABS_API_KEY\" });",
  "const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;\n    if (!apiKey) {\n      return res.status(500).json({ error: \"Missing ELEVENLABS_API_KEY\" });"
);

fs.writeFileSync('server.ts', content);
