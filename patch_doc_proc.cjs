const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

const target = `const SPACE_URL = 'https://paulhemb-redora.hf.space';`;
const replace = `// Space is now called via backend proxy`;

code = code.replace(target, replace);

const fetchTarget = `const response = await fetch(\`\${SPACE_URL}/process\`, {`;
const fetchReplace = `const endpoint = '/api/documents/process';
      const response = await fetch(endpoint, {`;
code = code.replace(fetchTarget, fetchReplace);

fs.writeFileSync('src/lib/documentProcessor.ts', code);
