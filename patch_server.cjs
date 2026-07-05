const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  'const vite = await createViteServer({',
  `const { createServer: createViteServer } = await import("vite");\n    const vite = await createViteServer({`
);
fs.writeFileSync('server.ts', code);
