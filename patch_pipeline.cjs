const fs = require('fs');
let code = fs.readFileSync('server/videoPipeline.ts', 'utf-8');
code = code.replace("let scenesData = [];", "let scenesData: any = [];");
fs.writeFileSync('server/videoPipeline.ts', code);
