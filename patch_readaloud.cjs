const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf-8');

const oldLogic = `                if (matchIdx !== -1) {
                    matches.push({ tsIndex: tsIdx, start: matchIdx, end: matchIdx + word.length - 1 });
                    searchIndex = matchIdx + word.length;
                }`;

const newLogic = `                if (matchIdx !== -1) {
                    // Prevent word drift: if the match is too far ahead, it's likely a false positive
                    // from LLM normalization (e.g. LLM added "squared" and it matched a "squared" 100 chars later).
                    if (matchIdx - searchIndex > 80) {
                        matchIdx = -1; // Ignore this match, it's too far
                    } else {
                        matches.push({ tsIndex: tsIdx, start: matchIdx, end: matchIdx + word.length - 1 });
                        searchIndex = matchIdx + word.length;
                    }
                }`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
