function chunkDocumentText(text: string, maxChunkSize = 300) {
    const chunks: { text: string; domIndex: number }[] = [];
    const blocks = text.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
    blocks.forEach((block: string, domIndex: number) => {
        const sentences = block.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [block];
        let currentChunk = "";
        sentences.forEach((s: string) => {
            if (s.trim().length > 0) {
                if (currentChunk.length + s.length > maxChunkSize && currentChunk.trim().length > 0) {
                    chunks.push({ text: currentChunk.trim(), domIndex });
                    currentChunk = s;
                } else {
                    currentChunk = currentChunk + s;
                }
            }
        });
        if (currentChunk.trim().length > 0) {
            chunks.push({ text: currentChunk.trim(), domIndex });
        }
    });
    return chunks;
}

const text = "- First item.\n- Second item.";
console.log(chunkDocumentText(text));
