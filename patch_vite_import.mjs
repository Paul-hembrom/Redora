import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

// Remove static import of vite
code = code.replace(/import\s*\{\s*createServer\s+as\s+createViteServer\s*\}\s*from\s*'vite';/, "");

// Replace the top-level await Vite creation
const oldVite = `if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}`;

const newVite = `
// Avoid top-level await and dynamic import Vite to avoid bloating production builds
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  import('vite').then(({ createServer: createViteServer }) => {
    createViteServer({ server: { middlewareMode: true }, appType: 'spa' }).then(vite => {
      app.use(vite.middlewares);
    });
  }).catch(err => console.error('Failed to start Vite middleware:', err));
}
`;

if (code.includes("const vite = await createViteServer")) {
    code = code.replace(oldVite, newVite);
}

fs.writeFileSync('server.ts', code);
console.log("Patched Vite import!");
