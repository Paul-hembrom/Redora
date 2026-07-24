const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /numChannels = audioBuffer\.readUInt16LE\(26\);\n      sampleRate = audioBuffer\.readUInt32LE\(28\);\n      bitsPerSample = audioBuffer\.readUInt16LE\(36\);/s;

const newCode = `numChannels = audioBuffer.readUInt16LE(22);
      sampleRate = audioBuffer.readUInt32LE(24);
      bitsPerSample = audioBuffer.readUInt16LE(34);`;

code = code.replace(regex, newCode);
fs.writeFileSync('server.ts', code);
console.log("Reverted to correct WAV header offsets");
