const fs = require('fs');
let code = fs.readFileSync('src/components/InteractiveLesson.tsx', 'utf8');

code = code.replace(/\}\)\(\)\(\)/g, '})()');

fs.writeFileSync('src/components/InteractiveLesson.tsx', code);
console.log('fixed IL');
