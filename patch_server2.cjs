const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /numChannels = audioBuffer\.readUInt16LE\(22\);\n      sampleRate = audioBuffer\.readUInt32LE\(24\);\n      bitsPerSample = audioBuffer\.readUInt16LE\(34\);/s;

const newCode = `numChannels = audioBuffer.readUInt16LE(26);
      sampleRate = audioBuffer.readUInt32LE(28);
      bitsPerSample = audioBuffer.readUInt16LE(36);`;

code = code.replace(regex, newCode);
fs.writeFileSync('server.ts', code);
console.log("Patched server.ts offsets");
