const fs = require('fs');

function replaceFile(path, replacer) {
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf-8');
    content = replacer(content);
    fs.writeFileSync(path, content);
  }
}

// gemini.ts
replaceFile('src/lib/gemini.ts', (content) => {
  content = `import { MODELS } from './models.js';\n` + content;
  content = content.replace(/export const MODEL_TEXT = "gemini-2.5-flash";\nexport const MODEL_VISION = "gemini-2.5-flash";\nexport const MODEL_MEMORY = "gemini-2.5-flash";\n/, '');
  content = content.replace(/model: 'deepseek-v4-flash'/g, `model: MODELS.text`);
  content = content.replace(/model: 'gemini-3.1-flash-tts-preview'/g, `model: MODELS.tts`);
  content = content.replace(/model: 'veo-3.1-lite-generate-preview'/g, `model: MODELS.video`);
  content = content.replace(/MODEL_TEXT/g, `MODELS.text`).replace(/MODEL_VISION/g, `MODELS.vision`);
  return content;
});

// documentProcessor.ts
replaceFile('src/lib/documentProcessor.ts', (content) => {
  content = `import { MODELS } from './models.js';\n` + content;
  content = content.replace(/import\.meta\.env\.VITE_MODEL_TEXT \|\| 'deepseek-v4-flash'/g, `MODELS.text`);
  return content;
});

// server/studentMemory.ts
replaceFile('server/studentMemory.ts', (content) => {
  content = `import { MODELS } from '../src/lib/models.js';\n` + content;
  content = content.replace(/process\.env\.MODEL_MEMORY \|\| "gemini-2.5-flash"/g, `MODELS.memory`);
  return content;
});

// server/synthesizeSpeech.ts
replaceFile('server/synthesizeSpeech.ts', (content) => {
  content = `import { MODELS } from '../src/lib/models.js';\n` + content;
  content = content.replace(/model: "gemini-3.1-flash-tts-preview"/g, `model: MODELS.tts`);
  return content;
});

// server/storyboardEngine.ts
replaceFile('server/storyboardEngine.ts', (content) => {
  content = `import { MODELS } from '../src/lib/models.js';\n` + content;
  content = content.replace(/process\.env\.MODEL_TEXT \|\| 'deepseek-v4-flash'/g, `MODELS.text`);
  return content;
});

console.log("Fixed models");
