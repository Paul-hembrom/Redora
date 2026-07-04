const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

const oldFuncRegex = /export async function extractTextViaDeepSeekVision\([\s\S]*?^  \n/m;
// Let's just find where it starts and ends
