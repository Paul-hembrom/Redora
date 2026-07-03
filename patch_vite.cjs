const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');

if (!code.includes('target:')) {
  code = code.replace(
    'plugins: [',
    "build: { target: 'esnext' },\n    plugins: ["
  );
}

fs.writeFileSync('vite.config.ts', code);
