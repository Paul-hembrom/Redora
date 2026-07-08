import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

if (!content.includes('callLLM')) {
  console.log('No callLLM found???');
}

if (!content.includes('import {') || !content.includes('callLLM}')) {
  content = content.replace(
    "import { generateChapterMetadata, generateSearchQueries } from './src/lib/gemini.js';",
    "import { generateChapterMetadata, generateSearchQueries, callLLM } from './src/lib/gemini.js';"
  );
  fs.writeFileSync('server.ts', content);
  console.log('Import updated');
} else {
  console.log('Import already present');
}
