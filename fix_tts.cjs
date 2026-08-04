const fs = require('fs');
let content = fs.readFileSync('src/lib/gemini.ts', 'utf-8');

const ttsOld = `    const chunks = await Promise.all(sentences.map(async (sentence: string, index: number) => {
       const response = await fetch(url, {`;
       
const ttsNew = `    const limit = (await import('./documentProcessor.js')).createConcurrencyLimit(3);
    const chunks = await Promise.all(
      sentences.map((sentence: string, index: number) => limit(async () => {
       const response = await fetch(url, {`;
       
content = content.replace(ttsOld, ttsNew);

const ttsOldEnd = `       const base64 = Buffer.from(audioBuffer).toString('base64');
       return { index, audioUrl: \`data:audio/mpeg;base64,\${base64}\` };
    }));

    const validChunks = chunks.filter(c => c !== null);
    if (validChunks.length === 0) return null;`;

const ttsNewEnd = `       const base64 = Buffer.from(audioBuffer).toString('base64');
       return { index, audioUrl: \`data:audio/mpeg;base64,\${base64}\` };
    })));

    const validChunks = chunks.filter(c => c !== null);
    if (validChunks.length === 0) {
      console.error(\`[TTS] All \${sentences.length} ElevenLabs chunks failed (likely rate limited).\`);
      return null;
    }
    if (validChunks.length < sentences.length) {
      console.warn(\`[TTS] \${sentences.length - validChunks.length}/\${sentences.length} chunks failed.\`);
    }`;

content = content.replace(ttsOldEnd, ttsNewEnd);

fs.writeFileSync('src/lib/gemini.ts', content);
console.log("Fixed TTS syntax");
