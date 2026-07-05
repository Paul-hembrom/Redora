const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace("  app.use('/api', stubRoutes);\n", "");
code = code.replace("  app.get(\"/api/health\", (req, res) => {\n    res.json({ status: \"ok\" });\n  });", "  app.get(\"/api/health\", (req, res) => {\n    res.json({ status: \"ok\" });\n  });\n  app.use('/api', stubRoutes);");

fs.writeFileSync('server.ts', code);
