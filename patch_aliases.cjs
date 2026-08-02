const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf-8');

const mathAliases = `
const MATH_ALIASES: Record<string, string[]> = {
    "squared": ["^2"],
    "cubed": ["^3"],
    "plus": ["+"],
    "minus": ["-"],
    "equals": ["="],
    "times": ["*", "\\\\times", "\\\\cdot"],
    "divided": ["/", "\\\\div"],
    "pi": ["π", "\\\\pi"],
    "alpha": ["\\\\alpha"],
    "beta": ["\\\\beta"],
    "gamma": ["\\\\gamma"],
    "theta": ["\\\\theta"],
    "infinity": ["∞", "\\\\infty"],
    "sine": ["\\\\sin"],
    "cosine": ["\\\\cos"],
    "tangent": ["\\\\tan"],
    "cosecant": ["\\\\csc"],
    "secant": ["\\\\sec"],
    "cotangent": ["\\\\cot"],
    "integral": ["\\\\int"],
    "sum": ["\\\\sum"],
    "less": ["<", "≤", "\\\\leq"],
    "greater": [">", "≥", "\\\\geq"],
    "approximately": ["≈", "\\\\approx"],
    "equivalent": ["\\\\equiv"],
    "sub": ["_"],
    "root": ["\\\\sqrt"]
};
`;

if (!code.includes("MATH_ALIASES")) {
    code = code.replace(
        "export function SmartReadAloudButton(",
        mathAliases + "\nexport function SmartReadAloudButton("
    );
}

const oldLogic = `                let regexPattern = wordEscaped;
                if (/^\\w/.test(word)) regexPattern = \`\\\\b\${regexPattern}\`;
                if (/\\w$/.test(word)) regexPattern = \`\${regexPattern}\\\\b\`;`;

const newLogic = `                let regexPattern = wordEscaped;
                const aliases = MATH_ALIASES[word.toLowerCase()];
                if (aliases) {
                    const aliasPattern = aliases.map(a => a.replace(/[.*+?^$\{}()|[\\]\\\\]/g, '\\\\$&')).join('|');
                    regexPattern = \`(\${regexPattern}|\${aliasPattern})\`;
                } else {
                    if (/^\\w/.test(word)) regexPattern = \`\\\\b\${regexPattern}\`;
                    if (/\\w$/.test(word)) regexPattern = \`\${regexPattern}\\\\b\`;
                }`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
