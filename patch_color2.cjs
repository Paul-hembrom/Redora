const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

code = code.replace(
  "highlightOverlay.className = 'absolute pointer-events-none bg-yellow-200/50 dark:bg-[#FEF08A]/30 rounded z-[100] transition-all duration-75 ease-linear mix-blend-multiply dark:mix-blend-normal';",
  "highlightOverlay.className = 'absolute pointer-events-none bg-[#FFFDE7] dark:bg-[#FEF08A]/30 rounded z-[100] transition-all duration-75 ease-linear mix-blend-multiply dark:mix-blend-screen';"
);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched color 2');
