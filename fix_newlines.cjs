const fs = require('fs');
let content = fs.readFileSync('src/lib/gemini.ts', 'utf-8');

content = content.replace(/summaryObj\.join\("\\\\n- "\)/g, 'summaryObj.join("\\n- ")');
content = content.replace(/summaryObj\.replace\(\/\\\\n\/g, '\\\\n'\)/g, "summaryObj.replace(/\\\\n/g, '\\n')");

fs.writeFileSync('src/lib/gemini.ts', content);
console.log("Fixed newlines");
