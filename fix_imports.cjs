const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');
code = code.replace("getGenAI\n} from './gemini';", "getGenAI,\n  withRetry\n} from './gemini';");
fs.writeFileSync('src/lib/documentProcessor.ts', code);
