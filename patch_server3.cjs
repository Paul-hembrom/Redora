const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const importStubs = `import stubRoutes from "./server/stub-routes.js";\n`;

code = code.replace('import express from "express";', 'import express from "express";\n' + importStubs);

const appConfig = `  app.use('/api', stubRoutes);\n`;

code = code.replace('  app.listen(PORT', appConfig + '  app.listen(PORT');

fs.writeFileSync('server.ts', code);
