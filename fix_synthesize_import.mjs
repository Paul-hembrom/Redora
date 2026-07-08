import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

if (!content.includes("import { synthesizeSpeech }")) {
  content = content.replace(
    "import { processVideoLessonJob, processSceneAssets } from './server/videoPipeline.js';",
    "import { processVideoLessonJob, processSceneAssets } from './server/videoPipeline.js';\nimport { synthesizeSpeech } from './server/synthesizeSpeech.js';"
  );
  fs.writeFileSync('server.ts', content);
  console.log('Import added');
} else {
  console.log('Import already exists');
}
