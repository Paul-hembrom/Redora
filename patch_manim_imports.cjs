const fs = require('fs');
let code = fs.readFileSync('src/services/manimRenderer.ts', 'utf-8');

const target1 = `// Mirrors main.py's FORBIDDEN_IMPORTS on the backend, so we steer the model
// away from imports it would get rejected for anyway.
const FORBIDDEN_IMPORTS = [
  'os', 'subprocess', 'sys', 'shutil', 'socket', 'requests', 'http',
  'urllib', 'pathlib', 'glob', 'pickle', 'eval', 'exec', 'compile',
  '__import__', 'open',
];`;

const replace1 = `const ALLOWED_IMPORTS = [
  'manim', 'numpy', 'np', 'math', 'random', 'itertools', 'functools', 'operator', 'typing', 'dataclasses', 'collections', 'fractions'
];`;

code = code.replace(target1, replace1);

const target2 = `- Do not import or use any of: \${FORBIDDEN_IMPORTS.join(', ')}. Use only Manim built-ins (and numpy if needed).`;
const replace2 = `- Only import from the following allowed modules: \${ALLOWED_IMPORTS.join(', ')}. Any other imports will fail.`;

code = code.replace(target2, replace2);
fs.writeFileSync('src/services/manimRenderer.ts', code);
