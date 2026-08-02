const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf-8');

const newAliases = `const MATH_ALIASES: Record<string, string[]> = {
    // Basic Arithmetic and Algebra
    "squared": ["^2"],
    "cubed": ["^3"],
    "plus": ["+"],
    "minus": ["-"],
    "equals": ["="],
    "times": ["*", "\\\\times", "\\\\cdot"],
    "divided": ["/", "\\\\div"],
    "less": ["<", "≤", "\\\\leq"],
    "greater": [">", "≥", "\\\\geq"],
    "approximately": ["≈", "\\\\approx"],
    "equivalent": ["\\\\equiv"],
    "sub": ["_"],
    "root": ["\\\\sqrt"],
    "proportional": ["\\\\propto"],
    
    // Greek Letters
    "pi": ["π", "\\\\pi"],
    "alpha": ["\\\\alpha"],
    "beta": ["\\\\beta"],
    "gamma": ["\\\\gamma"],
    "theta": ["\\\\theta"],
    "mu": ["\\\\mu"],
    "sigma": ["\\\\sigma"],
    "omega": ["\\\\omega", "\\\\Omega"],
    "delta": ["\\\\Delta"],
    "lambda": ["\\\\lambda"],
    "rho": ["\\\\rho"],
    "phi": ["\\\\phi"],

    // Calculus and Advanced Math
    "infinity": ["∞", "\\\\infty"],
    "integral": ["\\\\int", "\\\\iint", "\\\\iiint", "\\\\oint"],
    "sum": ["\\\\sum"],
    "product": ["\\\\prod"],
    "limit": ["\\\\lim"],
    "approaches": ["\\\\to", "\\\\rightarrow"],
    "partial": ["\\\\partial"],
    "del": ["\\\\nabla"],
    "determinant": ["\\\\det"],

    // Trigonometry
    "sine": ["\\\\sin"],
    "cosine": ["\\\\cos"],
    "tangent": ["\\\\tan"],
    "cosecant": ["\\\\csc"],
    "secant": ["\\\\sec"],
    "cotangent": ["\\\\cot"],
    
    // Sets and Logic
    "union": ["\\\\cup"],
    "intersection": ["\\\\cap"],
    "subset": ["\\\\subset", "\\\\subseteq"],
    "superset": ["\\\\supset", "\\\\supseteq"],
    "element": ["\\\\in"],
    "empty": ["\\\\emptyset", "\\\\varnothing"],
    "implies": ["\\\\implies"],
    
    // Geometry
    "angle": ["\\\\angle"],
    "triangle": ["\\\\triangle"],
    "parallel": ["\\\\parallel"],
    "perpendicular": ["\\\\perp"],
    "degrees": ["°", "\\\\circ"],
    "similar": ["\\\\sim"],
    "congruent": ["\\\\cong"],
    
    // Number Systems
    "natural": ["\\\\mathbb{N}"],
    "integers": ["\\\\mathbb{Z}"],
    "rational": ["\\\\mathbb{Q}"],
    "real": ["\\\\mathbb{R}"],
    "complex": ["\\\\mathbb{C}"]
};`;

const startIndex = code.indexOf("const MATH_ALIASES");
const endIndex = code.indexOf("};", startIndex) + 2;

code = code.substring(0, startIndex) + newAliases + code.substring(endIndex);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
