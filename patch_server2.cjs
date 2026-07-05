const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const importCookieParser = `import cookieParser from "cookie-parser";\nimport authRoutes from "./server/auth-routes.js";\nimport meRoutes from "./server/me-routes.js";\n`;

code = code.replace('import express from "express";', 'import express from "express";\n' + importCookieParser);

const appConfig = `  app.use(express.json());\n  app.use(cookieParser());\n  app.use('/api/auth', authRoutes);\n  app.use('/api/me', meRoutes);\n`;

code = code.replace('  app.get("/api/health"', appConfig + '  app.get("/api/health"');

fs.writeFileSync('server.ts', code);
