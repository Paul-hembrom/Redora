const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const regex = /const ENABLE_SPLIT_RETRY = false;\s*if \(ENABLE_SPLIT_RETRY\) \{[\s\S]*?\} else \{/m;
const replacement = `const actualChapters = mapped.length;
    const expectedChapters = estimatedChapterCount || 0;
    if (expectedChapters > 0 && actualChapters < expectedChapters * 0.8) {
      console.warn(\`Chapter count low: expected \${expectedChapters}, got \${actualChapters}. Split-retry is disabled.\`);
    }
    if (false) {
      // Disabled split retry
    } else {`;
code = code.replace(regex, replacement);

fs.writeFileSync('src/lib/gemini.ts', code);
