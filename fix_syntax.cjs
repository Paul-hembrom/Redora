const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

code = code.replace(/      };\n      };\n\n      \/\/ Start reading the stream/, '      };\n\n      // Start reading the stream');
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('fixed syntax');
