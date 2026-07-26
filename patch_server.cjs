const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/voice = "af_bella"/g, 'voice = "af_sarah"');
code = code.replace(/"bf_emma", "bf_isabella", "bm_george", "bm_lewis", "af_bella"/g, '"bf_emma", "bf_isabella", "bm_george", "bm_lewis", "af_bella", "af_sarah"');
code = code.replace(/kokoroVoice = supportedVoices.includes\(voice\) \? voice : "af_bella";/g, 'kokoroVoice = supportedVoices.includes(voice) ? voice : "af_sarah";');

fs.writeFileSync('server.ts', code);

