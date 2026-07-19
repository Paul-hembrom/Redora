const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldLogic = `        let spokenText = normalizeTextForCartesia(chunk.text);
        if (/\\\\(?:int|sum|begin|sin|cos|lim|frac|sqrt|tan|prod|theta|alpha|beta|gamma|omega|sigma)|\\\\{|\\\\}/i.test(chunk.text)) {
            spokenText = await normalizeTextWithLLM(spokenText);
        }`;

const newLogic = `        const cleanChunk = normalizeTextForCartesia(chunk.text);
        let spokenText = cleanChunk;
        if (/\\\\(?:int|sum|begin|sin|cos|lim|frac|sqrt|tan|prod|theta|alpha|beta|gamma|omega|sigma)|\\\\{|\\\\}/i.test(chunk.text)) {
            spokenText = await normalizeTextWithLLM(cleanChunk);
        }`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('server.ts', code);
console.log('patched loop body');
