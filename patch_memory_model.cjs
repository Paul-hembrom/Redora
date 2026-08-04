const fs = require('fs');
let code = fs.readFileSync('server/studentMemory.ts', 'utf-8');
code = code.replace(`model: "gemini-3.1-flash-preview",`, `model: process.env.MODEL_MEMORY || "gemini-2.5-flash",`);
fs.writeFileSync('server/studentMemory.ts', code);
