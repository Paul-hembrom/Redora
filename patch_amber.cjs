const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

code = code.replace(
  "highlightOverlay.className = 'absolute pointer-events-none bg-[#FFFDE7] mix-blend-multiply dark:mix-blend-normal dark:bg-[#FEF08A]/30 rounded z-[100] transition-all duration-75 ease-linear';",
  "highlightOverlay.className = 'absolute pointer-events-none bg-amber-400/70 rounded z-[100] transition-all duration-75 ease-linear';"
);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched to amber');
