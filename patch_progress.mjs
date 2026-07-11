import fs from 'fs';

let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf-8');

// Add progress state
content = content.replace(
  "const [errorMsg, setErrorMsg] = useState('');",
  "const [errorMsg, setErrorMsg] = useState('');\n  const [progress, setProgress] = useState(0);"
);

// Add totalChunks parameter to playQueue
content = content.replace(
  "const playQueue = async (chunks: any[], sentences: string[], currentSentenceIndex: number = 0) => {",
  "const playQueue = async (chunks: any[], sentences: string[], currentSentenceIndex: number = 0, totalChunks: number = chunks.length) => {"
);

// Update progress inside playQueue
content = content.replace(
  "const currentChunk = chunks.shift();",
  "const currentChunk = chunks.shift();\n    setProgress(Math.round(((currentSentenceIndex + 1) / totalChunks) * 100));"
);

// Reset progress inside tryElevenLabsTTS
content = content.replace(
  "setIsLoading(true);",
  "setIsLoading(true);\n      setProgress(0);"
);

// Pass totalChunks to recursive call
content = content.replace(
  "playQueue(chunks, sentences, currentSentenceIndex + 1);",
  "playQueue(chunks, sentences, currentSentenceIndex + 1, totalChunks);"
);

// Reset progress on stop
content = content.replace(
  "setIsPlaying(false);",
  "setIsPlaying(false);\n    setProgress(0);"
);

// Add a progress bar to the button rendering
content = content.replace(
  "<div className=\"flex items-center gap-1\">",
  "<div className=\"flex items-center gap-1\">\n            {progress > 0 && <span className=\"text-[10px] font-mono text-cyan-400 absolute -bottom-4\">{progress}%</span>}"
);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
