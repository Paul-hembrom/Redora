import fs from 'fs';

const content = fs.readFileSync('src/lib/gemini.ts', 'utf8');
const lines = content.split('\n');
const bigString = lines[0];

// Let's find all occurrences of \\n and print their context
const occurrences = [];
let idx = bigString.indexOf('\\n');
while (idx !== -1) {
  occurrences.push(bigString.substring(Math.max(0, idx - 20), Math.min(bigString.length, idx + 20)));
  idx = bigString.indexOf('\\n', idx + 1);
}

fs.writeFileSync('occurrences.txt', occurrences.join('\n'));
console.log('Done');
