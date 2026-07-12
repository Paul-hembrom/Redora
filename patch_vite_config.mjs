import fs from 'fs';

let config = fs.readFileSync('vite.config.ts', 'utf8');

config = config.replace(/build:\s*\{\s*target:\s*'esnext'\s*\}/, `build: { 
      target: 'esnext',
      chunkSizeWarningLimit: 4000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('pdfjs-dist')) return 'pdf';
              if (id.includes('mammoth')) return 'documentProcessor';
              if (id.includes('lucide-react')) return 'icons';
              return 'vendor';
            }
          }
        }
      }
    }`);

fs.writeFileSync('vite.config.ts', config);
console.log('Patched vite.config.ts');
