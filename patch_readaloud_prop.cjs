const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// Update Props interface
code = code.replace(
  "interface Props {",
  "interface Props {\n  playbackRate?: number;"
);

// Update destructuring
code = code.replace(
  "export function SmartReadAloudButton({ text, className, iconSizeClasses = \"w-4 h-4\", containerRef, idPrefix = \"tts-sentence-\" }: Props) {",
  "export function SmartReadAloudButton({ text, className, iconSizeClasses = \"w-4 h-4\", containerRef, idPrefix = \"tts-sentence-\", playbackRate = 0.8 }: Props) {"
);

// Replace hardcoded 0.8 with playbackRate
code = code.replace(
  /audio\.playbackRate = 0\.8;/g,
  "audio.playbackRate = playbackRate;"
);

code = code.replace(
  /utterance\.rate = 0\.8;/g,
  "utterance.rate = playbackRate;"
);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched ReadAloudButton.tsx');
