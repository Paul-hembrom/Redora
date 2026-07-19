const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace("\\napp.post('/api/tts/stream', async (req, res) => {", "\napp.post('/api/tts/stream', async (req, res) => {");
fs.writeFileSync('server.ts', code);
