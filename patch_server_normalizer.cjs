const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const normalizerFn = `
function normalizeTextForCartesia(text: string): string {
    let t = text;
    // Strip LaTeX delimiters
    t = t.replace(/\\$\\$(.*?)\\$\\$/g, ' $1 ');
    t = t.replace(/\\$(.*?)\\$/g, ' $1 ');

    // Acronyms and abbreviations
    t = t.replace(/\\bCOVID-19\\b/gi, 'Covid nineteen');
    t = t.replace(/\\bAI\\b/g, 'A.I.');
    t = t.replace(/\\be\\.g\\./gi, 'for example');
    t = t.replace(/\\bi\\.e\\./gi, 'that is');
    t = t.replace(/\\betc\\./gi, 'etcetera');

    // Function notation (simple like f(x))
    t = t.replace(/\\b([a-zA-Z])\\(([a-zA-Z0-9_]+)\\)/g, '$1 of $2');

    // Fractions \\frac{a}{b} -> a over b
    t = t.replace(/\\\\frac\\{([^}]+)\\}\\{([^}]+)\\}/g, '$1 over $2');

    // Square roots \\sqrt{a} -> the square root of a
    t = t.replace(/\\\\sqrt\\{([^}]+)\\}/g, 'the square root of $1');

    // Exponents
    t = t.replace(/([a-zA-Z0-9]+)\\^2/g, '$1 squared');
    t = t.replace(/([a-zA-Z0-9]+)\\^3/g, '$1 cubed');
    t = t.replace(/([a-zA-Z0-9]+)\\^\\{([^}]+)\\}/g, '$1 to the power of $2');

    // Common math symbols
    t = t.replace(/π/g, ' pi ');
    t = t.replace(/∞/g, ' infinity ');
    t = t.replace(/±/g, ' plus or minus ');
    t = t.replace(/≤/g, ' less than or equal to ');
    t = t.replace(/≥/g, ' greater than or equal to ');

    // Basic math operators
    t = t.replace(/\\s+\\+\\s+/g, ' plus ');
    t = t.replace(/\\s+-\\s+/g, ' minus ');
    t = t.replace(/\\s+=\\s+/g, ' equals ');
    t = t.replace(/\\s+\\/\\s+/g, ' divided by ');
    t = t.replace(/\\s+\\*\\s+/g, ' times ');

    // Clean up extra spaces
    t = t.replace(/\\s+/g, ' ').trim();

    return t;
}

`;

code = code.replace("function chunkDocumentText(text: string) {", normalizerFn + "function chunkDocumentText(text: string) {");

const callReplacement = `        await context.send({ transcript: normalizeTextForCartesia(chunk.text) });`;
code = code.replace(`        await context.send({ transcript: chunk.text });`, callReplacement);

fs.writeFileSync('server.ts', code);
console.log('patched cartesia server with normalizer');
