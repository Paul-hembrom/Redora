const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');
code = code.replace(/extractSummaryForChapter\n\} from '\.\/gemini';/, "extractSummaryForChapter,\n  getGenAI\n} from './gemini';");
fs.writeFileSync('src/lib/documentProcessor.ts', code);
