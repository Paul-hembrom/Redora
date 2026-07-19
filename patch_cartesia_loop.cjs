const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Update chunkDocumentText
const newChunker = `function chunkDocumentText(text: string, maxChunkSize = 300) {
    const chunks: { text: string; domIndex: number }[] = [];
    const blocks = text.split(/\\n\\n+/).map((s: string) => s.trim()).filter(Boolean);
    blocks.forEach((block: string, domIndex: number) => {
        const sentences = block.match(/[^.!?]+[.!?]+(?:\\s+|$)|[^.!?]+$/g) || [block];
        let currentChunk = "";
        sentences.forEach((s: string) => {
            const t = s.trim();
            if (t.length > 0) {
                if (currentChunk.length + t.length > maxChunkSize && currentChunk.length > 0) {
                    chunks.push({ text: currentChunk.trim(), domIndex });
                    currentChunk = t;
                } else {
                    currentChunk = currentChunk ? currentChunk + " " + t : t;
                }
            }
        });
        if (currentChunk.length > 0) {
            chunks.push({ text: currentChunk.trim(), domIndex });
        }
    });
    return chunks;
}`;

code = code.replace(/function chunkDocumentText\([\s\S]*?return chunks;\n\}/, newChunker);

// 2. Replace the cartesia loop
const oldLoopStart = `    for (let i = 0; i < chunks.length; i++) {`;
const oldLoopEndRegex = /ws\.close\(\);\n/s;

// We need to carefully replace the logic inside app.post('/api/tts/cartesia')
// Let's just do a string replacement for the specific block.
