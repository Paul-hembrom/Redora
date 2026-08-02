const fs = require('fs');
let code = fs.readFileSync('src/lib/mathTTS.ts', 'utf-8');

const replacements = `
    // --- Expanded Sets and Logic ---
    t = t.replace(/\\\\cup\\b/g, ' union ');
    t = t.replace(/\\\\cap\\b/g, ' intersection ');
    t = t.replace(/\\\\subset\\b/g, ' is a subset of ');
    t = t.replace(/\\\\subseteq\\b/g, ' is a subset of or equal to ');
    t = t.replace(/\\\\supset\\b/g, ' is a superset of ');
    t = t.replace(/\\\\supseteq\\b/g, ' is a superset of or equal to ');
    t = t.replace(/\\\\in\\b/g, ' is an element of ');
    t = t.replace(/\\\\notin\\b/g, ' is not an element of ');
    t = t.replace(/\\\\emptyset\\b/g, ' empty set ');
    t = t.replace(/\\\\varnothing\\b/g, ' empty set ');
    t = t.replace(/\\\\forall\\b/g, ' for all ');
    t = t.replace(/\\\\exists\\b/g, ' there exists ');
    t = t.replace(/\\\\nexists\\b/g, ' there does not exist ');
    t = t.replace(/\\\\implies\\b/g, ' implies ');
    t = t.replace(/\\\\iff\\b/g, ' if and only if ');

    // --- Expanded Number Systems ---
    t = t.replace(/\\\\mathbb\\{N\\}/g, ' the set of natural numbers ');
    t = t.replace(/\\\\mathbb\\{Z\\}/g, ' the set of integers ');
    t = t.replace(/\\\\mathbb\\{Q\\}/g, ' the set of rational numbers ');
    t = t.replace(/\\\\mathbb\\{R\\}/g, ' the set of real numbers ');
    t = t.replace(/\\\\mathbb\\{C\\}/g, ' the set of complex numbers ');

    // --- Geometry and Trigonometry ---
    t = t.replace(/\\\\angle\\b/g, ' angle ');
    t = t.replace(/\\\\triangle\\b/g, ' triangle ');
    t = t.replace(/\\\\parallel\\b/g, ' is parallel to ');
    t = t.replace(/\\\\perp\\b/g, ' is perpendicular to ');
    t = t.replace(/\\^\\\\circ\\b/g, ' degrees ');
    t = t.replace(/°/g, ' degrees ');
    
    // --- Calculus and Advanced Math ---
    t = t.replace(/\\\\lim\\b/g, ' limit ');
    t = t.replace(/\\\\to\\b/g, ' approaches ');
    t = t.replace(/\\\\rightarrow\\b/g, ' approaches ');
    t = t.replace(/\\\\partial\\b/g, ' partial derivative of ');
    t = t.replace(/\\\\nabla\\b/g, ' del ');
    t = t.replace(/\\\\int\\b/g, ' integral of ');
    t = t.replace(/\\\\iint\\b/g, ' double integral of ');
    t = t.replace(/\\\\iiint\\b/g, ' triple integral of ');
    t = t.replace(/\\\\oint\\b/g, ' contour integral of ');
    t = t.replace(/\\\\sum\\b/g, ' sum of ');
    t = t.replace(/\\\\prod\\b/g, ' product of ');

    // --- Extra Greek Letters ---
    t = t.replace(/\\\\mu\\b/g, ' mu ');
    t = t.replace(/\\\\sigma\\b/g, ' sigma ');
    t = t.replace(/\\\\omega\\b/g, ' omega ');
    t = t.replace(/\\\\Omega\\b/g, ' capital omega ');
    t = t.replace(/\\\\Delta\\b/g, ' delta ');
    t = t.replace(/\\\\lambda\\b/g, ' lambda ');
    t = t.replace(/\\\\rho\\b/g, ' rho ');
    t = t.replace(/\\\\phi\\b/g, ' phi ');

    // --- Matrices and Vectors ---
    t = t.replace(/\\\\vec\\{([^}]+)\\}/g, ' vector $1 ');
    t = t.replace(/\\\\mathbf\\{([^}]+)\\}/g, ' vector $1 ');
    t = t.replace(/\\\\det\\b/g, ' determinant ');
    
    // --- Algebra / Miscellaneous ---
    t = t.replace(/\\\\sim\\b/g, ' is similar to ');
    t = t.replace(/\\\\cong\\b/g, ' is congruent to ');
    t = t.replace(/\\\\propto\\b/g, ' is proportional to ');
    t = t.replace(/\\\\mid\\b/g, ' given ');
    t = t.replace(/\\\\choose\\b/g, ' choose ');

    // Clean up multiple spaces
    t = t.replace(/\\s+/g, ' ').trim();
    
    return t;
`;

// regex replace to catch any spacing
code = code.replace(/\s*\/\/\s*Clean up multiple spaces\s*t = t\.replace\(\/\\s\+\/g, ' '\)\.trim\(\);\s*return t;\s*/, "\n" + replacements + "\n");
fs.writeFileSync('src/lib/mathTTS.ts', code);
