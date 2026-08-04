const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const match = code.match(/function normalizeTextForCartesia\(text: string\): string \{([\s\S]+?)\n\}\n/);
if (match) {
  const funcBody = match[0];
  const newFileContent = `export ${funcBody}`;
  fs.writeFileSync('src/lib/textNormalize.ts', newFileContent);
  
  code = code.replace(funcBody, '');
  if (!code.includes("import { normalizeTextForCartesia }")) {
      code = "import { normalizeTextForCartesia } from './src/lib/textNormalize.js';\n" + code;
  }
  fs.writeFileSync('server.ts', code);
  
  let pipeline = fs.readFileSync('server/videoPipeline.ts', 'utf-8');
  if (!pipeline.includes("import { normalizeTextForCartesia }")) {
      pipeline = "import { normalizeTextForCartesia } from '../src/lib/textNormalize.js';\n" + pipeline;
  }
  
  const target = "let cleanText = narration.replace(/[^a-zA-Z0-9\\s.,!?\\-:;()]/g, ' ');";
  const replace = "let cleanText = normalizeTextForCartesia(narration);";
  
  pipeline = pipeline.replace(target, replace);
  fs.writeFileSync('server/videoPipeline.ts', pipeline);
} else {
  console.log("Could not find normalizeTextForCartesia");
}
