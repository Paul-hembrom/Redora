const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

code = code.replace(/line-height: 2;/g, "line-height: 1.2;");

fs.writeFileSync('src/index.css', code);
