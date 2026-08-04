const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf-8');

const target = `  const chunks = await Promise.all(
    sentences.map(async (sentence, index) => {`;

const replace = `  const { createConcurrencyLimit } = await import('./documentProcessor.js');
  const limit = createConcurrencyLimit(3);
  const chunks = await Promise.all(
    sentences.map((sentence, index) => limit(async () => {`;

// Replace closing `}))` if needed
const closeTarget = `    })
  );`;
const closeReplace = `    }))
  );`;

if (code.includes(target)) {
  code = code.replace(target, replace);
  code = code.replace(closeTarget, closeReplace);
  fs.writeFileSync('src/lib/gemini.ts', code);
}
