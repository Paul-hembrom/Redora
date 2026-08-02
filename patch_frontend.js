import fs from 'fs';
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// We will add globalSearchIndexRef
if (!content.includes('globalSearchIndexRef')) {
    content = content.replace(
        'const playSessionIdRef = useRef(0);',
        'const playSessionIdRef = useRef(0);\n  const globalSearchIndexRef = useRef(0);'
    );
    // Reset it on triggerSpeech
    content = content.replace(
        'playSessionIdRef.current += 1;',
        'playSessionIdRef.current += 1;\n    globalSearchIndexRef.current = 0;'
    );

    // Update playNextChunk to use it
    content = content.replace(
        'let searchIndex = 0;',
        'let searchIndex = globalSearchIndexRef.current;'
    );

    content = content.replace(
        'let chunkOffset = fullText.indexOf(chunk.text);',
        'let chunkOffset = chunk.text ? fullText.indexOf(chunk.text, searchIndex) : -1;'
    );

    // Update globalSearchIndexRef after processing matches
    content = content.replace(
        '// Pass 2: wrap matches in *descending* start-offset order',
        'globalSearchIndexRef.current = searchIndex;\n            // Pass 2: wrap matches in *descending* start-offset order'
    );

    fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
    console.log("Patched ReadAloudButton.tsx");
} else {
    console.log("Already patched.");
}
