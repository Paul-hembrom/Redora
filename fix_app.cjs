const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Remove static imports
code = code.replace("import { processDocument } from './lib/documentProcessor';\n", "");
code = code.replace("import { generateChatResponse } from './lib/gemini';\n", "");

// Replace processDocument call with dynamic import
const oldCall = `const chapters = await processDocument(file, options, setUploadProgress, {`;
const newCall = `const { processDocument } = await import('./lib/documentProcessor');
        const chapters = await processDocument(file, options, setUploadProgress, {`;
code = code.replace(oldCall, newCall);

fs.writeFileSync('src/App.tsx', code);
