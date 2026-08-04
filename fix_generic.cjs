const fs = require('fs');
let content = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

const target1 = `  let i = 0;
  while (i < cleaned.length - 1) {
    const a = cleaned[i];
    const b = cleaned[i + 1];
    const aClean = sanitizeTitle(a.title);
    const bClean = sanitizeTitle(b.title);

    if (aClean === bClean && aClean.length > 0) {`;

const newTarget1 = `  const GENERIC_TITLES = new Set([
    'introduction', 'conclusion', 'summary', 'exercises',
    'overview', 'references', 'contents', 'preface', 'glossary'
  ]);

  let i = 0;
  while (i < cleaned.length - 1) {
    const a = cleaned[i];
    const b = cleaned[i + 1];
    const aClean = sanitizeTitle(a.title);
    const bClean = sanitizeTitle(b.title);

    if (aClean === bClean && aClean.length > 0 && !GENERIC_TITLES.has(aClean)) {`;
    
content = content.replace(target1, newTarget1);

const target2 = `        const textToSplit = topics.length === 1
          ? topics[0].content
          : chapterChunks.find(c => c.title === chapter.title)?.content || '';`;

const newTarget2 = `        const chapterIdx = chapterResults.indexOf(chapter);
        const textToSplit = topics.length === 1
          ? topics[0].content
          : (chapterChunks[chapterIdx]?.content || '');`;

content = content.replace(target2, newTarget2);

fs.writeFileSync('src/lib/documentProcessor.ts', content);
console.log("Fixed generic merging");
