import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const authRoutesRegex = /\/\/ --- Auth Routes ---\napp\.post\('\/api\/auth\/signup'[\s\S]*?res\.status\(401\)\.json\(\{ error: 'Unauthorized' \};\n  \}\n\}\);\n/g;

const match = code.match(authRoutesRegex);
if (match) {
    const authRoutesText = match[0];
    // Remove it from its current position
    code = code.replace(authRoutesText, '');
    
    // Insert it before `if (!process.env.VERCEL) {`
    const insertPoint = code.indexOf('if (!process.env.VERCEL) {');
    if (insertPoint !== -1) {
        code = code.substring(0, insertPoint) + authRoutesText + "\n" + code.substring(insertPoint);
        fs.writeFileSync('server.ts', code);
        console.log("Successfully moved auth routes.");
    } else {
        console.log("Could not find VERCEL check.");
    }
} else {
    console.log("Could not find auth routes using regex.");
}
