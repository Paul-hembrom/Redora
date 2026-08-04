const fs = require('fs');
let content = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

const oldCheck = `  const SPACE_URL = import.meta.env.VITE_HF_SPACE_URL;
  if (!SPACE_URL) {
    throw new Error('VITE_HF_SPACE_URL is not set in environment');
  }

  const endpoint = '/api/documents/process';`;

const newCheck = `  const endpoint = '/api/documents/process';`;

content = content.replace(oldCheck, newCheck);
fs.writeFileSync('src/lib/documentProcessor.ts', content);
console.log("Fixed documentProcessor.ts");
