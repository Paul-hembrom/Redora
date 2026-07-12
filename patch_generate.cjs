const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

// Find the code to insert from fix_server.mjs
const fixScript = fs.readFileSync('fix_server.mjs', 'utf8');
const routeMatch = fixScript.match(/(app\.post\('\/api\/curriculum\/generate', authenticate, async \(req: any, res\) => \{[\s\S]*?\n\}\);\n)/);

if (routeMatch) {
    const routeCode = routeMatch[1];
    
    // insert before Vite middleware
    const target = '// Vite middleware';
    if (!serverCode.includes("app.post('/api/curriculum/generate'")) {
        serverCode = serverCode.replace(target, routeCode + '\n\n' + target);
        fs.writeFileSync('server.ts', serverCode);
        console.log('Inserted route!');
    } else {
        console.log('Route already exists!');
    }
} else {
    console.log('Could not extract route from fix_server.mjs');
}
