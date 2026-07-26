const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const targetLog = `            console.log("HQ toggled – now:", newHQ);`;
const replacementLog = `            console.log('HQ toggled – now: ' + newHQ);`;

code = code.replace(targetLog, replacementLog);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
