const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// The route in fix_server.mjs had backslashes. We can replace them.
code = code.replace(/\\\$/g, '$');
code = code.replace(/\\`/g, '\`');
// Wait, \n inside the string was probably literal \n.
// Let's replace \\n with \n
code = code.replace(/\\\\n/g, '\\n');

fs.writeFileSync('server.ts', code);
