const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'await document.documentElement.requestFullscreen().catch(err => console.error(err));\n      setIsDesktopSidebarCollapsed(true);',
  "await document.documentElement.requestFullscreen().catch(err => console.error(err));\n      setIsDesktopSidebarCollapsed(true);\n      setFocusFontSize('3xl');"
);

fs.writeFileSync('src/App.tsx', code);
