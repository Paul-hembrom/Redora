export function latexToPhonetic(text: string): string {
    let t = text;
    
    // Strip LaTeX delimiters for inline and block math
    t = t.replace(/\$\$(.*?)\$\$/g, ' $1 ');
    t = t.replace(/\$(.*?)\$/g, ' $1 ');

    // Fractions \frac{a}{b} -> a over b
    t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, ' $1 over $2 ');
    
    // Square roots \sqrt{a} -> the square root of a
    t = t.replace(/\\sqrt\{([^}]+)\}/g, ' the square root of $1 ');
    
    // Exponents and powers
    t = t.replace(/([a-zA-Z0-9_]+)\^2/g, ' $1 squared ');
    t = t.replace(/([a-zA-Z0-9_]+)\^3/g, ' $1 cubed ');
    t = t.replace(/([a-zA-Z0-9_]+)\^\{([^}]+)\}/g, ' $1 to the power of $2 ');
    t = t.replace(/([a-zA-Z0-9_]+)\^([a-zA-Z0-9_]+)/g, ' $1 to the power of $2 ');

    // Subscripts
    t = t.replace(/([a-zA-Z0-9_]+)_\{([^}]+)\}/g, ' $1 sub $2 ');
    t = t.replace(/([a-zA-Z0-9_]+)_([a-zA-Z0-9_]+)/g, ' $1 sub $2 ');

    // Trigonometry and functions
    t = t.replace(/\\sin\b/g, ' sine ');
    t = t.replace(/\\cos\b/g, ' cosine ');
    t = t.replace(/\\tan\b/g, ' tangent ');
    t = t.replace(/\\csc\b/g, ' cosecant ');
    t = t.replace(/\\sec\b/g, ' secant ');
    t = t.replace(/\\cot\b/g, ' cotangent ');
    t = t.replace(/\\log\b/g, ' log ');
    t = t.replace(/\\ln\b/g, ' natural log ');

    // Common Greek letters and symbols
    t = t.replace(/\\pi\b/g, ' pi ');
    t = t.replace(/\\alpha\b/g, ' alpha ');
    t = t.replace(/\\beta\b/g, ' beta ');
    t = t.replace(/\\gamma\b/g, ' gamma ');
    t = t.replace(/\\theta\b/g, ' theta ');
    t = t.replace(/\\infty\b/g, ' infinity ');
    t = t.replace(/\\pm\b/g, ' plus or minus ');
    t = t.replace(/\\times\b/g, ' times ');
    t = t.replace(/\\div\b/g, ' divided by ');
    t = t.replace(/\\leq\b/g, ' less than or equal to ');
    t = t.replace(/\\geq\b/g, ' greater than or equal to ');
    t = t.replace(/\\neq\b/g, ' not equal to ');
    t = t.replace(/\\approx\b/g, ' approximately equal to ');
    t = t.replace(/\\equiv\b/g, ' equivalent to ');
    t = t.replace(/\\cdot\b/g, ' times ');
    t = t.replace(/\\sum\b/g, ' sum of ');
    t = t.replace(/\\int\b/g, ' integral of ');

    // Unicode math symbols
    t = t.replace(/π/g, ' pi ');
    t = t.replace(/∞/g, ' infinity ');
    t = t.replace(/±/g, ' plus or minus ');
    t = t.replace(/≤/g, ' less than or equal to ');
    t = t.replace(/≥/g, ' greater than or equal to ');
    t = t.replace(/≠/g, ' not equal to ');
    t = t.replace(/≈/g, ' approximately equal to ');

    // Basic operators (spaced carefully to avoid breaking regular text like hyphenated words)
    t = t.replace(/\s+\+\s+/g, ' plus ');
    t = t.replace(/\s+=\s+/g, ' equals ');
    t = t.replace(/\s+\/\s+/g, ' divided by ');
    t = t.replace(/\s+\*\s+/g, ' times ');

    // --- Expanded Sets and Logic ---
    t = t.replace(/\\cup\b/g, ' union ');
    t = t.replace(/\\cap\b/g, ' intersection ');
    t = t.replace(/\\subset\b/g, ' is a subset of ');
    t = t.replace(/\\subseteq\b/g, ' is a subset of or equal to ');
    t = t.replace(/\\supset\b/g, ' is a superset of ');
    t = t.replace(/\\supseteq\b/g, ' is a superset of or equal to ');
    t = t.replace(/\\in\b/g, ' is an element of ');
    t = t.replace(/\\notin\b/g, ' is not an element of ');
    t = t.replace(/\\emptyset\b/g, ' empty set ');
    t = t.replace(/\\varnothing\b/g, ' empty set ');
    t = t.replace(/\\forall\b/g, ' for all ');
    t = t.replace(/\\exists\b/g, ' there exists ');
    t = t.replace(/\\nexists\b/g, ' there does not exist ');
    t = t.replace(/\\implies\b/g, ' implies ');
    t = t.replace(/\\iff\b/g, ' if and only if ');

    // --- Expanded Number Systems ---
    t = t.replace(/\\mathbb\{N\}/g, ' the set of natural numbers ');
    t = t.replace(/\\mathbb\{Z\}/g, ' the set of integers ');
    t = t.replace(/\\mathbb\{Q\}/g, ' the set of rational numbers ');
    t = t.replace(/\\mathbb\{R\}/g, ' the set of real numbers ');
    t = t.replace(/\\mathbb\{C\}/g, ' the set of complex numbers ');

    // --- Geometry and Trigonometry ---
    t = t.replace(/\\angle\b/g, ' angle ');
    t = t.replace(/\\triangle\b/g, ' triangle ');
    t = t.replace(/\\parallel\b/g, ' is parallel to ');
    t = t.replace(/\\perp\b/g, ' is perpendicular to ');
    t = t.replace(/\^\\circ\b/g, ' degrees ');
    t = t.replace(/°/g, ' degrees ');
    
    // --- Calculus and Advanced Math ---
    t = t.replace(/\\lim\b/g, ' limit ');
    t = t.replace(/\\to\b/g, ' approaches ');
    t = t.replace(/\\rightarrow\b/g, ' approaches ');
    t = t.replace(/\\partial\b/g, ' partial derivative of ');
    t = t.replace(/\\nabla\b/g, ' del ');
    t = t.replace(/\\int\b/g, ' integral of ');
    t = t.replace(/\\iint\b/g, ' double integral of ');
    t = t.replace(/\\iiint\b/g, ' triple integral of ');
    t = t.replace(/\\oint\b/g, ' contour integral of ');
    t = t.replace(/\\sum\b/g, ' sum of ');
    t = t.replace(/\\prod\b/g, ' product of ');

    // --- Extra Greek Letters ---
    t = t.replace(/\\mu\b/g, ' mu ');
    t = t.replace(/\\sigma\b/g, ' sigma ');
    t = t.replace(/\\omega\b/g, ' omega ');
    t = t.replace(/\\Omega\b/g, ' capital omega ');
    t = t.replace(/\\Delta\b/g, ' delta ');
    t = t.replace(/\\lambda\b/g, ' lambda ');
    t = t.replace(/\\rho\b/g, ' rho ');
    t = t.replace(/\\phi\b/g, ' phi ');

    // --- Matrices and Vectors ---
    t = t.replace(/\\vec\{([^}]+)\}/g, ' vector $1 ');
    t = t.replace(/\\mathbf\{([^}]+)\}/g, ' vector $1 ');
    t = t.replace(/\\det\b/g, ' determinant ');
    
    // --- Algebra / Miscellaneous ---
    t = t.replace(/\\sim\b/g, ' is similar to ');
    t = t.replace(/\\cong\b/g, ' is congruent to ');
    t = t.replace(/\\propto\b/g, ' is proportional to ');
    t = t.replace(/\\mid\b/g, ' given ');
    t = t.replace(/\\choose\b/g, ' choose ');

    // Clean up multiple spaces
    t = t.replace(/\s+/g, ' ').trim();
    
    return t;

}
