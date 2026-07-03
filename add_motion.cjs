const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "import { twMerge } from 'tailwind-merge';",
  "import { twMerge } from 'tailwind-merge';\nimport { motion, AnimatePresence } from 'motion/react';"
);

fs.writeFileSync('src/App.tsx', code);
