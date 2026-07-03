const fs = require('fs');

let geminiCode = fs.readFileSync('src/lib/gemini.ts', 'utf8');
let docProcCode = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

// Find extractTextViaDeepSeekVision in gemini.ts
const startIdx = geminiCode.indexOf('export async function extractTextViaDeepSeekVision(');
let endIdx = -1;
if (startIdx !== -1) {
  // We'll search for the end of the function. The next export or end of file.
  const nextExportIdx = geminiCode.indexOf('export ', startIdx + 10);
  if (nextExportIdx !== -1) {
    endIdx = nextExportIdx;
  } else {
    endIdx = geminiCode.length;
  }
}

if (startIdx !== -1 && endIdx !== -1) {
  const funcCode = geminiCode.substring(startIdx, endIdx);
  
  // Remove from gemini.ts
  geminiCode = geminiCode.substring(0, startIdx) + geminiCode.substring(endIdx);
  fs.writeFileSync('src/lib/gemini.ts', geminiCode);

  // Add to documentProcessor.ts (needs to import callLLM)
  // documentProcessor.ts already imports callLLM.
  docProcCode = docProcCode + '\n' + funcCode;
  
  // Also remove it from the import { extractTextViaDeepSeekVision } from './gemini';
  docProcCode = docProcCode.replace(/extractTextViaDeepSeekVision,\s*/, '');
  
  fs.writeFileSync('src/lib/documentProcessor.ts', docProcCode);
  console.log("Moved extractTextViaDeepSeekVision successfully");
} else {
  console.log("Could not find function in gemini.ts");
}
