const fs = require('fs');
let code = fs.readFileSync('server/lessonOrchestrator.ts', 'utf-8');

const ttsLoopStart = code.indexOf('for (const step of steps) {');
const returnStatement = code.indexOf('return steps;', ttsLoopStart);

if (ttsLoopStart !== -1 && returnStatement !== -1) {
    code = code.substring(0, ttsLoopStart) + code.substring(returnStatement);
    fs.writeFileSync('server/lessonOrchestrator.ts', code);
}
