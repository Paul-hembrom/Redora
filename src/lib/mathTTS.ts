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
    
    // Clean up multiple spaces
    t = t.replace(/\s+/g, ' ').trim();
    
    return t;
}
