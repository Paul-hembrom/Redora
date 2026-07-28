const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'onClick={() => setIsFocusMode(true)}',
  "onClick={() => { setIsFocusMode(true); setFocusFontSize('3xl'); }}"
);

fs.writeFileSync('src/App.tsx', code);
