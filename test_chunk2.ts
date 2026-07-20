function chunkDocumentText(text: string, maxChunkSize = 300) {
    const chunks: { text: string; domIndex: number }[] = [];
    const blocks = text.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
    blocks.forEach((block: string, domIndex: number) => {
        const sentences = block.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [block];
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
}

const text = "This is a sentence.\n- First item.\n- Second item.\n5 - 3 = 2.";
console.log(chunkDocumentText(text));
