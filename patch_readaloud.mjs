import fs from 'fs';

let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf-8');

// replace getSentenceElement usage
content = content.replace(
  "const targetEl = getSentenceElement(container, currentSentence);",
  "const targetEl = container.querySelector(`[data-sentence-index=\"${currentSentenceIndex}\"]`);\nif (targetEl) {\n  container.querySelectorAll('[data-sentence-index]').forEach(el => el.classList.remove('bg-cyan-500/20', 'text-cyan-300'));\n  targetEl.classList.add('bg-cyan-500/20', 'text-cyan-300');\n}"
);

// update playQueue definition
content = content.replace(
  "const playQueue = async (chunks: any[], sentences: string[]) => {",
  "const playQueue = async (chunks: any[], sentences: string[], currentSentenceIndex: number = 0) => {"
);

// update playQueue recursive call
content = content.replace(
  "playQueue(chunks, sentences);",
  "playQueue(chunks, sentences, currentSentenceIndex + 1);"
);

// clean up styles when stopped
content = content.replace(
  "const stopPlaying = () => {",
  "const stopPlaying = () => {\n  if (containerRef?.current) {\n    containerRef.current.querySelectorAll('[data-sentence-index]').forEach(el => el.classList.remove('bg-cyan-500/20', 'text-cyan-300'));\n  }\n  if (buttonRef.current) {\n    const container = buttonRef.current.closest('.prose, .content, .reader, .markdown-body');\n    if (container) container.querySelectorAll('[data-sentence-index]').forEach(el => el.classList.remove('bg-cyan-500/20', 'text-cyan-300'));\n  }"
);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
