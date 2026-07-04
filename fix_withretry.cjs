const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

const regex = /const isRateLimit = err instanceof ApiRateLimitError;/;
const replacement = "const isRateLimit = err instanceof ApiRateLimitError || (err && err.message && err.message.includes('429'));";
code = code.replace(regex, replacement);

fs.writeFileSync('src/lib/documentProcessor.ts', code);
