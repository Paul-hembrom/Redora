const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// We need to replace the curriculum fetching logic.
// There are two places: one in the unauthenticated block (lines ~191-205)
// and one in the authenticated block (lines ~268-295).

code = code.replace(/const source = urlParams\.get\('source'\);/, "const source = urlParams.get('source');\n    const subtopic = urlParams.get('subtopic');");
code = code.replace(/const source = urlParams\.get\('source'\);/, "const source = urlParams.get('source');\n    const subtopic = urlParams.get('subtopic');");

fs.writeFileSync('src/App.tsx', code);
