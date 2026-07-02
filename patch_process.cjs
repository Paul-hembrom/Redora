const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

// 1. empty subtopics check
const cleanupLogic = `
  // 4. Remove empty subtopics
  for (const chapter of chapterResults) {
    if (chapter.children) {
      const originalCount = chapter.children.length;
      chapter.children = chapter.children.filter(child => {
        if (child.type === 'topic') {
          const content = child.content || '';
          if (content.trim().length === 0 || content.length < 20) return false;
          const title = child.title || '';
          if (!title.trim() || title.match(/^Topic 1A$/i)) return false;
        }
        return true;
      });
      if (chapter.children.length < originalCount) {
        console.warn(\`Removed \${originalCount - chapter.children.length} empty subtopics from \${chapter.title}\`);
      }
    }
  }

  finalChapters = chapterResults;`;

code = code.replace(/finalChapters = chapterResults;/, cleanupLogic);

// 2. Hallucinated exercise check
const hallucinationLogic = `
    // Deduplicate exercise content blocks
    if (finalExercisesContent) {
      let lines = finalExercisesContent.split('\\n\\n').map(l => l.trim()).filter(Boolean);
      lines = [...new Set(lines)];
      
      const fullChapterText = (chapter.content || '') + '\\n' + (chapter.children || []).map(c => c.content).join('\\n');
      lines = lines.filter(line => {
        const lowerLine = line.toLowerCase();
        const suspiciousPhrases = ['prepare a chart', 'conduct an interview', 'project work', 'visit a', 'group discussion'];
        for (const phrase of suspiciousPhrases) {
           if (lowerLine.includes(phrase) && !fullChapterText.toLowerCase().includes(phrase)) {
               console.warn(\`Removed hallucinated exercise line: \${line.substring(0, 50)}...\`);
               return false;
           }
        }
        return true;
      });

      finalExercisesContent = lines.join('\\n\\n');
    }
`;

code = code.replace(/\/\/ Deduplicate exercise content blocks\n    if \(finalExercisesContent\) \{\n      let lines = finalExercisesContent.split\(\'\\n\\n\'\).map\(l => l.trim\(\)\).filter\(Boolean\);\n      lines = \[\.\.\.new Set\(lines\)\];\n      finalExercisesContent = lines.join\(\'\\n\\n\'\);\n    \}/, hallucinationLogic);

fs.writeFileSync('src/lib/documentProcessor.ts', code);
