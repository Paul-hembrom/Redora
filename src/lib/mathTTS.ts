export const MATH_TRANSFORMATIONS: Record<string, string> = {
    // --- Basic Arithmetic and Operators ---
    '\\+': ' plus ',
    '-': ' minus ',
    '=': ' equals ',
    '\\times': ' times ',
    '\\cdot': ' times ',
    '\\div': ' divided by ',
    '\\pm': ' plus or minus ',
    '\\mp': ' minus or plus ',
    
    // --- Relations ---
    '<': ' is less than ',
    '>': ' is greater than ',
    '\\leq': ' is less than or equal to ',
    '\\geq': ' is greater than or equal to ',
    '\\neq': ' is not equal to ',
    '\\approx': ' is approximately equal to ',
    '\\equiv': ' is equivalent to ',
    '\\sim': ' is similar to ',
    '\\cong': ' is congruent to ',
    '\\propto': ' is proportional to ',

    // --- Greek Letters (Lowercase & Uppercase) ---
    '\\alpha': ' alpha ',
    '\\beta': ' beta ',
    '\\gamma': ' gamma ',
    '\\Gamma': ' capital gamma ',
    '\\delta': ' delta ',
    '\\Delta': ' capital delta ',
    '\\epsilon': ' epsilon ',
    '\\varepsilon': ' epsilon ',
    '\\zeta': ' zeta ',
    '\\eta': ' eta ',
    '\\theta': ' theta ',
    '\\Theta': ' capital theta ',
    '\\vartheta': ' theta ',
    '\\iota': ' iota ',
    '\\kappa': ' kappa ',
    '\\lambda': ' lambda ',
    '\\Lambda': ' capital lambda ',
    '\\mu': ' mu ',
    '\\nu': ' nu ',
    '\\xi': ' xi ',
    '\\Xi': ' capital xi ',
    '\\pi': ' pi ',
    '\\Pi': ' capital pi ',
    '\\rho': ' rho ',
    '\\varrho': ' rho ',
    '\\sigma': ' sigma ',
    '\\Sigma': ' capital sigma ',
    '\\tau': ' tau ',
    '\\upsilon': ' upsilon ',
    '\\Upsilon': ' capital upsilon ',
    '\\phi': ' phi ',
    '\\varphi': ' phi ',
    '\\Phi': ' capital phi ',
    '\\chi': ' chi ',
    '\\psi': ' psi ',
    '\\Psi': ' capital psi ',
    '\\omega': ' omega ',
    '\\Omega': ' capital omega ',

    // --- Sets and Logic ---
    '\\cup': ' union ',
    '\\cap': ' intersection ',
    '\\subset': ' is a proper subset of ',
    '\\subseteq': ' is a subset of ',
    '\\supset': ' is a proper superset of ',
    '\\supseteq': ' is a superset of ',
    '\\in': ' is an element of ',
    '\\notin': ' is not an element of ',
    '\\ni': ' contains as an element ',
    '\\emptyset': ' the empty set ',
    '\\varnothing': ' the empty set ',
    '\\forall': ' for all ',
    '\\exists': ' there exists ',
    '\\nexists': ' there does not exist ',
    '\\implies': ' implies ',
    '\\iff': ' if and only if ',
    '\\lor': ' or ',
    '\\land': ' and ',
    '\\lnot': ' not ',
    '\\neg': ' not ',
    '\\setminus': ' minus set ',

    // --- Number Systems ---
    '\\mathbb{N}': ' the set of natural numbers ',
    '\\mathbb{Z}': ' the set of integers ',
    '\\mathbb{Q}': ' the set of rational numbers ',
    '\\mathbb{R}': ' the set of real numbers ',
    '\\mathbb{C}': ' the set of complex numbers ',
    '\\mathbb{P}': ' the set of primes ',

    // --- Geometry and Trigonometry ---
    '\\angle': ' angle ',
    '\\measuredangle': ' measured angle ',
    '\\triangle': ' triangle ',
    '\\parallel': ' is parallel to ',
    '\\perp': ' is perpendicular to ',
    '^\\circ': ' degrees ',
    '°': ' degrees ',
    '\\sin': ' sine ',
    '\\cos': ' cosine ',
    '\\tan': ' tangent ',
    '\\csc': ' cosecant ',
    '\\sec': ' secant ',
    '\\cot': ' cotangent ',
    '\\arcsin': ' arc sine ',
    '\\arccos': ' arc cosine ',
    '\\arctan': ' arc tangent ',
    '\\sinh': ' hyperbolic sine ',
    '\\cosh': ' hyperbolic cosine ',
    '\\tanh': ' hyperbolic tangent ',

    // --- Calculus and Advanced Math ---
    '\\lim': ' limit ',
    '\\to': ' approaches ',
    '\\rightarrow': ' approaches ',
    '\\infty': ' infinity ',
    '\\partial': ' partial derivative of ',
    '\\nabla': ' del ',
    '\\int': ' integral of ',
    '\\iint': ' double integral of ',
    '\\iiint': ' triple integral of ',
    '\\oint': ' contour integral of ',
    '\\sum': ' sum of ',
    '\\prod': ' product of ',
    '\\mathrm{d}': ' d ', // for dx, dy, etc.
    '\\ln': ' natural log ',
    '\\log': ' log ',
    '\\exp': ' exponential ',

    // --- Matrices and Vectors ---
    '\\det': ' determinant ',
    '\\text{tr}': ' trace ',
    '\\operatorname{tr}': ' trace ',
    '\\dim': ' dimension ',
    '\\ker': ' kernel ',

    // --- Miscellaneous / Algebra ---
    '\\mid': ' given ', // probability P(A|B) or set comprehension
    '\\choose': ' choose ',
    '\\pmod': ' modulo ',
    '\\mod': ' mod ',

    // --- Unicode Math Symbols (if directly in text) ---
    'π': ' pi ',
    '∞': ' infinity ',
    '±': ' plus or minus ',
    '≤': ' is less than or equal to ',
    '≥': ' is greater than or equal to ',
    '≠': ' is not equal to ',
    '≈': ' is approximately equal to ',
    '×': ' times ',
    '÷': ' divided by ',
    '∑': ' sum of ',
    '∫': ' integral of ',
    '√': ' square root ',
    'Δ': ' delta ',
    'θ': ' theta ',
    'α': ' alpha ',
    'β': ' beta ',
    'γ': ' gamma ',
    '∈': ' is an element of ',
    '∉': ' is not an element of ',
    '⊂': ' is a subset of ',
    '∪': ' union ',
    '∩': ' intersection ',
};

export function latexToPhonetic(text: string): string {
    let t = text;
    
    // Strip LaTeX delimiters for inline and block math
    t = t.replace(/\$\$(.*?)\$\$/g, ' $1 ');
    t = t.replace(/\$(.*?)\$/g, ' $1 ');

    // 1. Process parameterized LaTeX constructs via Regex
    // Fractions \frac{a}{b} -> a over b
    t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, ' $1 over $2 ');
    
    // Square roots \sqrt{a} -> the square root of a
    t = t.replace(/\\sqrt\{([^}]+)\}/g, ' the square root of $1 ');
    
    // Limits with bounds \lim_{x \to \infty} -> limit as x approaches infinity
    t = t.replace(/\\lim_\{([^}]+)\\to([^}]+)\}/g, ' limit as $1 approaches $2 of ');
    
    // Integrals with bounds \int_{a}^{b} -> integral from a to b
    t = t.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, ' integral from $1 to $2 of ');
    t = t.replace(/\\int_([a-zA-Z0-9]+)\^([a-zA-Z0-9]+)/g, ' integral from $1 to $2 of ');
    
    // Sums with bounds \sum_{i=1}^{n} -> sum from i equals 1 to n
    t = t.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, ' sum from $1 to $2 of ');
    t = t.replace(/\\sum_([a-zA-Z0-9]+)\^([a-zA-Z0-9]+)/g, ' sum from $1 to $2 of ');

    // Exponents and powers
    t = t.replace(/([a-zA-Z0-9_]+)\^2/g, ' $1 squared ');
    t = t.replace(/([a-zA-Z0-9_]+)\^3/g, ' $1 cubed ');
    t = t.replace(/([a-zA-Z0-9_]+)\^\{([^}]+)\}/g, ' $1 to the power of $2 ');
    t = t.replace(/([a-zA-Z0-9_]+)\^([a-zA-Z0-9_]+)/g, ' $1 to the power of $2 ');

    // Subscripts
    t = t.replace(/([a-zA-Z0-9_]+)_\{([^}]+)\}/g, ' $1 sub $2 ');
    t = t.replace(/([a-zA-Z0-9_]+)_([a-zA-Z0-9_]+)/g, ' $1 sub $2 ');

    // Vectors and Matrices
    t = t.replace(/\\vec\{([^}]+)\}/g, ' vector $1 ');
    t = t.replace(/\\mathbf\{([^}]+)\}/g, ' vector $1 ');
    t = t.replace(/\\hat\{([^}]+)\}/g, ' $1 hat ');
    t = t.replace(/\\bar\{([^}]+)\}/g, ' $1 bar ');
    
    // Matrix environments (read simply as "matrix")
    t = t.replace(/\\begin\{(?:p|b|B|v|V)?matrix\}([\s\S]*?)\\end\{(?:p|b|B|v|V)?matrix\}/g, ' matrix $1 ');
    t = t.replace(/\\&/g, ' next column '); // for reading matrix columns
    t = t.replace(/\\\\/g, ' next row '); // for reading matrix rows

    // Derivatives
    t = t.replace(/\\frac\{d([a-zA-Z]+)\}\{d([a-zA-Z]+)\}/g, ' derivative of $1 with respect to $2 ');
    t = t.replace(/\\frac\{\\partial([a-zA-Z]+)\}\{\\partial([a-zA-Z]+)\}/g, ' partial derivative of $1 with respect to $2 ');

    // 2. Process static symbols from MATH_TRANSFORMATIONS
    // We sort keys by length descending to match longest sequences first (e.g., \subseteq before \subset)
    const sortedKeys = Object.keys(MATH_TRANSFORMATIONS).sort((a, b) => b.length - a.length);
    
    for (const key of sortedKeys) {
        // Escape regex characters in key just in case, though they are mostly word characters and backslashes
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Use word boundary for alphabetic latex commands to avoid partial matching (e.g. \int matching inside \integral)
        // If the key starts with backslash and ends with letter, we can use a word boundary
        let regexStr = escapedKey;
        if (/^[a-zA-Z]$/.test(key.slice(-1))) {
             regexStr += "\\b";
        }
        
        const regex = new RegExp(regexStr, 'g');
        t = t.replace(regex, MATH_TRANSFORMATIONS[key]);
    }

    // 3. Clean up generic basic operators (+, =)
    // (spaced carefully to avoid breaking regular text like hyphenated words)
    t = t.replace(/\s+\+\s+/g, ' plus ');
    t = t.replace(/\s+=\s+/g, ' equals ');
    t = t.replace(/\s+\/\s+/g, ' divided by ');
    t = t.replace(/\s+\*\s+/g, ' times ');

    // Clean up multiple spaces
    t = t.replace(/\s+/g, ' ').trim();
    
    return t;
}
