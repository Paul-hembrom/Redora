const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

const target1 = `  const extractionJobs = chapterResults.map((chapter) => limit(async () => {`;
const replace1 = `  const extractionJobs = chapterResults.map((chapter, index) => limit(async () => {`;

const target2 = `    return { chapter, aiExercises, aiTechnicalTerms, aiSummary };
  }));`;
const replace2 = `    return { chapter, aiExercises, aiTechnicalTerms, aiSummary, chunkIndex: index };
  }));`;

const target3 = `  for (const { chapter, aiExercises, aiTechnicalTerms, aiSummary } of extractionResults) {
    const topics = chapter.children?.filter(c => c.type === 'topic') || [];
    const exercises = chapter.children?.filter(c => c.type === 'exercise') || [];

    // 1. Force-split if 0 subtopics or 1 massive subtopic
    if (topics.length <= 1) {
      const textToSplit = topics.length === 1 ? topics[0].content : chapterChunks.find(c => c.title === chapter.title)?.content || '';`;
      
const replace3 = `  for (const { chapter, aiExercises, aiTechnicalTerms, aiSummary, chunkIndex } of extractionResults) {
    const topics = chapter.children?.filter(c => c.type === 'topic') || [];
    const exercises = chapter.children?.filter(c => c.type === 'exercise') || [];

    // 1. Force-split if 0 subtopics or 1 massive subtopic
    if (topics.length <= 1) {
      const textToSplit = topics.length === 1 ? topics[0].content : chapterChunks[chunkIndex]?.content || '';`;

code = code.replace(target1, replace1);
code = code.replace(target2, replace2);
code = code.replace(target3, replace3);

fs.writeFileSync('src/lib/documentProcessor.ts', code);
