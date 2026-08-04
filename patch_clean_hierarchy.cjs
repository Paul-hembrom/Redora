const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

const target = `    if (aClean === bClean && aClean.length > 0) {`;

const replace = `    const GENERIC_TITLES = new Set([
      'introduction','conclusion','summary','exercises','overview','references','contents'
    ]);
    
    if (aClean === bClean && aClean.length > 0 && !GENERIC_TITLES.has(aClean)) {`;

code = code.replace(target, replace);
fs.writeFileSync('src/lib/documentProcessor.ts', code);
