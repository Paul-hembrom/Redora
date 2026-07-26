const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const importRegex = /import \{\s*([^}]+)\s*\} from 'lucide-react';/;
code = code.replace(importRegex, (match, p1) => {
  return `import { \${p1}, Maximize2, Minimize2 } from 'lucide-react';`;
});

fs.writeFileSync('src/App.tsx', code);
