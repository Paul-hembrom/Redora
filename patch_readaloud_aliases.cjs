const fs = require('fs');

let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf-8');

const newAliases = `const MATH_ALIASES: Record<string, string[]> = {
    // Basic Arithmetic and Algebra
    "squared": ["^2"],
    "cubed": ["^3"],
    "plus": ["+", "\\\\+"],
    "minus": ["-"],
    "equals": ["="],
    "times": ["*", "\\\\times", "\\\\cdot", "×"],
    "divided": ["/", "\\\\div", "÷"],
    "less": ["<", "≤", "\\\\leq"],
    "greater": [">", "≥", "\\\\geq"],
    "approximately": ["≈", "\\\\approx"],
    "equivalent": ["\\\\equiv"],
    "sub": ["_"],
    "root": ["\\\\sqrt", "√"],
    "proportional": ["\\\\propto"],
    
    // Greek Letters
    "pi": ["π", "\\\\pi", "\\\\Pi"],
    "alpha": ["α", "\\\\alpha"],
    "beta": ["β", "\\\\beta"],
    "gamma": ["γ", "\\\\gamma", "\\\\Gamma"],
    "delta": ["Δ", "δ", "\\\\delta", "\\\\Delta"],
    "epsilon": ["\\\\epsilon", "\\\\varepsilon"],
    "zeta": ["\\\\zeta"],
    "eta": ["\\\\eta"],
    "theta": ["θ", "\\\\theta", "\\\\Theta", "\\\\vartheta"],
    "iota": ["\\\\iota"],
    "kappa": ["\\\\kappa"],
    "lambda": ["λ", "\\\\lambda", "\\\\Lambda"],
    "mu": ["μ", "\\\\mu"],
    "nu": ["ν", "\\\\nu"],
    "xi": ["\\\\xi", "\\\\Xi"],
    "rho": ["ρ", "\\\\rho", "\\\\varrho"],
    "sigma": ["σ", "\\\\sigma", "\\\\Sigma"],
    "tau": ["\\\\tau"],
    "upsilon": ["\\\\upsilon", "\\\\Upsilon"],
    "phi": ["φ", "\\\\phi", "\\\\varphi", "\\\\Phi"],
    "chi": ["\\\\chi"],
    "psi": ["\\\\psi", "\\\\Psi"],
    "omega": ["ω", "\\\\omega", "\\\\Omega"],

    // Calculus and Advanced Math
    "infinity": ["∞", "\\\\infty"],
    "integral": ["\\\\int", "\\\\iint", "\\\\iiint", "\\\\oint", "∫"],
    "sum": ["\\\\sum", "∑"],
    "product": ["\\\\prod"],
    "limit": ["\\\\lim"],
    "approaches": ["\\\\to", "\\\\rightarrow"],
    "partial": ["\\\\partial"],
    "del": ["\\\\nabla"],
    "determinant": ["\\\\det"],
    "trace": ["\\\\text{tr}", "\\\\operatorname{tr}"],
    "dimension": ["\\\\dim"],
    "kernel": ["\\\\ker"],

    // Trigonometry
    "sine": ["\\\\sin"],
    "cosine": ["\\\\cos"],
    "tangent": ["\\\\tan"],
    "cosecant": ["\\\\csc"],
    "secant": ["\\\\sec"],
    "cotangent": ["\\\\cot"],
    "hyperbolic": ["\\\\sinh", "\\\\cosh", "\\\\tanh"],
    
    // Sets and Logic
    "union": ["\\\\cup", "∪"],
    "intersection": ["\\\\cap", "∩"],
    "subset": ["\\\\subset", "\\\\subseteq", "⊂"],
    "superset": ["\\\\supset", "\\\\supseteq"],
    "element": ["\\\\in", "∈"],
    "contains": ["\\\\ni"],
    "empty": ["\\\\emptyset", "\\\\varnothing"],
    "implies": ["\\\\implies"],
    "exists": ["\\\\exists"],
    "all": ["\\\\forall"],
    
    // Geometry
    "angle": ["\\\\angle", "\\\\measuredangle"],
    "triangle": ["\\\\triangle"],
    "parallel": ["\\\\parallel"],
    "perpendicular": ["\\\\perp"],
    "degrees": ["°", "^\\\\circ", "\\\\circ"],
    "similar": ["\\\\sim"],
    "congruent": ["\\\\cong"],
    
    // Number Systems
    "natural": ["\\\\mathbb{N}"],
    "integers": ["\\\\mathbb{Z}"],
    "rational": ["\\\\mathbb{Q}"],
    "real": ["\\\\mathbb{R}"],
    "complex": ["\\\\mathbb{C}"],
    "primes": ["\\\\mathbb{P}"]
};`;

const startIndex = code.indexOf("const MATH_ALIASES");
const endIndex = code.indexOf("};", startIndex) + 2;

code = code.substring(0, startIndex) + newAliases + code.substring(endIndex);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
