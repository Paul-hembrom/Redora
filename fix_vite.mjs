import fs from 'fs';
let content = fs.readFileSync('vite.config.ts', 'utf-8');

const regex = /runtimeCaching:\s*\[[\s\S]*?(?=\n\s*manifest:)/;
const replacement = `runtimeCaching: [
            {
              urlPattern: /\\/api\\/.*/i,
              handler: 'NetworkOnly'
            },
            {
              urlPattern: /^https:\\/\\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'external-cache',
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] }
              }
            }
          ]
        },`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync('vite.config.ts', content);
  console.log("Updated runtimeCaching to bypass API requests");
} else {
  console.log("Could not find runtimeCaching section");
}
