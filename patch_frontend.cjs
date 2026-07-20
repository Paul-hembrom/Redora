const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

code = code.replace(/tryElevenLabsTTS/g, 'tryCartesiaTTS');
code = code.replace(/'\/api\/tts\/stream'/g, "'/api/tts/cartesia'");
code = code.replace(/'ElevenLabs TTS API call failed:'/g, "'Cartesia TTS API call failed:'");
code = code.replace(/'ElevenLabs TTS API call successful/g, "'Cartesia TTS API call successful");

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched frontend route to cartesia');
