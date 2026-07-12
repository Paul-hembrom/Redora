import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

// The issue is an unclosed `if (!process.env.VERCEL) {` block that we failed to replace properly.
// Let's just remove that literal `if (!process.env.VERCEL) {` that precedes the auth routes.

code = code.replace(/if \(!process\.env\.VERCEL\) \{\s*\/\/\s*---\s*Auth Routes\s*---/, "// --- Auth Routes ---");

fs.writeFileSync('server.ts', code);
console.log("Patched unclosed block");
