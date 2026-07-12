import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const target1 = "if (!process.env.VERCEL) {\n  // --- Auth Routes ---";
const replacement1 = "// --- Auth Routes ---";
code = code.replace(target1, replacement1);

const target2 = "app.listen(PORT, '0.0.0.0', () => {";
const replacement2 = "if (!process.env.VERCEL) {\n  app.listen(PORT, '0.0.0.0', () => {";
code = code.replace(target2, replacement2);

fs.writeFileSync('server.ts', code);
console.log("Patched successfully!");
