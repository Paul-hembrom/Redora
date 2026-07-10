import fs from 'fs';

let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');

// The original signature had `isStudent`
const targetSigStart = `  summarizingChapters,
  isStudent
}: ChapterNodeProps & {`;

const replacementSigStart = `  summarizingChapters,
  isStudent,
  isReadOnly
}: ChapterNodeProps & {`;

if (content.includes(targetSigStart)) {
    content = content.replace(targetSigStart, replacementSigStart);
    fs.writeFileSync('src/components/Sidebar.tsx', content);
    console.log('Fixed ChapterNode signature.');
} else {
    console.log('Could not find ChapterNode signature to fix.');
}
