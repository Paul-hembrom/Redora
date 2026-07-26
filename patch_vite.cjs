const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');

const target = `workbox: {
          globPatterns:`;

const replacement = `workbox: {
          clientsClaim: true,
          skipWaiting: true,
          globPatterns:`;

code = code.replace(target, replacement);

fs.writeFileSync('vite.config.ts', code);
