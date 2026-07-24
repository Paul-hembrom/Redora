const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /const audioBytes = Buffer\.from\(data\.audio_base64, 'base64'\)\.length;\n    const PLAYBACK_RATE = 0\.8;\n    const rawDuration = Math\.max\(0, \(audioBytes - 44\) \/ \(24000 \* 2\)\);/s;

const newCode = `const audioBuffer = Buffer.from(data.audio_base64, 'base64');
    const audioBytes = audioBuffer.length;
    const PLAYBACK_RATE = 0.8;
    let numChannels = 1;
    let sampleRate = 24000;
    let bitsPerSample = 16;
    if (audioBytes > 44) {
      numChannels = audioBuffer.readUInt16LE(22);
      sampleRate = audioBuffer.readUInt32LE(24);
      bitsPerSample = audioBuffer.readUInt16LE(34);
    }
    const dataSize = audioBytes - 44;
    const bytesPerSample = bitsPerSample / 8;
    const bytesPerFrame = numChannels * bytesPerSample;
    const totalFrames = dataSize / bytesPerFrame;
    const rawDuration = Math.max(0, totalFrames / sampleRate);`;

code = code.replace(regex, newCode);
fs.writeFileSync('server.ts', code);
console.log("Patched server.ts");
