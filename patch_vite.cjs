const fs = require('fs');
let content = fs.readFileSync('vite.config.ts', 'utf8');

content = content.replace(/globPatterns: \['\*\*\/\*\.\{js,css,html,ico,png,svg,woff,woff2,ttf\}'\],/, `globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'],
          globIgnores: ['server.js', 'server.cjs'],`);
content = content.replace(/maximumFileSizeToCacheInBytes: 5 \* 1024 \* 1024,/, `maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,`);

fs.writeFileSync('vite.config.ts', content);
console.log("Patched vite config");
