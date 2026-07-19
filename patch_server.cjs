const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex1 = /    const ws = await cartesia\.tts\.websocket\(\);/g;
const replacement1 = `    const ws = await cartesia.tts.websocket();
    ws.on('error', (err) => {
      console.error('Cartesia WebSocket error:', err);
    });`;

code = code.replace(regex1, replacement1);

const regex2 = /model_id: 'sonic-english'/g;
const replacement2 = `model_id: 'sonic-3.5'`;

code = code.replace(regex2, replacement2);

fs.writeFileSync('server.ts', code);
console.log('patched cartesia server');
