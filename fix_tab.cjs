const fs = require('fs');
let code = fs.readFileSync('src/lib/mathTTS.ts', 'utf-8');
code = code.replace(/\\lim_\\{([^}]+)\t(.*?)o([^}]+)\\}/g, "\\\\lim_\\{([^}]+)\\\\to([^}]+)\\}");
fs.writeFileSync('src/lib/mathTTS.ts', code);
