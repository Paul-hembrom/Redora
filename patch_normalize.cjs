const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newNormalize = `function normalizeTextForCartesia(text: string): string {
    let t = text;

    // --- List Processing ---
    let bulletCounter = 1;
    
    // For numbered lists (add a spoken pause by ensuring the previous line ended with a period, and formatting as "1: ")
    t = t.replace(/([.!?])\\s*\\n\\s*(\\d+)\\.\\s+/g, (match, punct, num) => {
        bulletCounter = 1; // reset bullet counter
        return \`\${punct} \${num}: \`;
    });
    t = t.replace(/(^|[^.!?])\\s*\\n\\s*(\\d+)\\.\\s+/g, (match, prevChar, num) => {
        bulletCounter = 1;
        return \`\${prevChar}. \${num}: \`; // Add a period for spoken pause before the number
    });
    t = t.replace(/^\\s*(\\d+)\\.\\s+/g, (match, num) => {
        bulletCounter = 1;
        return \`\${num}: \`;
    });
    
    // For bullet lists: replace with "Point X: "
    t = t.replace(/([.!?])\\s*\\n\\s*([-*•])\\s+/g, (match, punct) => {
        return \`\${punct} Point \${bulletCounter++}: \`;
    });
    t = t.replace(/(^|[^.!?])\\s*\\n\\s*([-*•])\\s+/g, (match, prevChar) => {
        return \`\${prevChar}. Point \${bulletCounter++}: \`; // Add period for pause
    });
    t = t.replace(/^\\s*([-*•])\\s+/g, () => {
        return \`Point \${bulletCounter++}: \`;
    });
    
    // Also handle flattened lists (where chunkDocumentText replaced \\n with space after a period)
    t = t.replace(/([.!?])\\s+([-*•])\\s+/g, (match, punct) => {
        return \`\${punct} Point \${bulletCounter++}: \`;
    });
    t = t.replace(/([.!?])\\s+(\\d+)\\.\\s+/g, (match, punct, num) => {
        bulletCounter = 1;
        return \`\${punct} \${num}: \`;
    });
    // --- End List Processing ---

    // Strip LaTeX delimiters`;

code = code.replace(/function normalizeTextForCartesia\(text: string\): string \{\s*let t = text;\s*\/\/ Strip LaTeX delimiters/, newNormalize);

fs.writeFileSync('server.ts', code);
console.log('Patched server.ts');
