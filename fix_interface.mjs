import fs from 'fs';

let content = fs.readFileSync('src/components/InteractiveLesson.tsx', 'utf-8');

content = content.replace(
`  narration_audio_url?: string;
  narrationText?: string;`,
`  narration_audio_url?: string;
  narration_audio_chunks?: { index: number; audioUrl: string }[];
  narrationText?: string;`
);

fs.writeFileSync('src/components/InteractiveLesson.tsx', content);
console.log('done');
