// ---------------------------------------------------------------------------
// UNICODE / TYPED-MATH LAYER
//
// The LaTeX rules above only fire on \commands. Curriculum prose is full of
// PLAIN typed maths -- "(-y, x)", "x²", "√25", "x < 5", "cos²θ", "Q₁", "½" --
// none of which reached the model as speech. The reported symptom was
// "(x, y) becomes (-y, x)" being voiced as "y, x": the minus was silently
// dropped because the only minus rule required whitespace on BOTH sides.
//
// This layer runs AFTER LaTeX handling and BEFORE the final cleanup.
// ---------------------------------------------------------------------------

const SUPERSCRIPT_MAP: Record<string, string> = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5',
    '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-',
    'ⁿ': 'n', 'ⁱ': 'i', 'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e',
    'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ʲ': 'j', 'ᵏ': 'k', 'ˡ': 'l', 'ᵐ': 'm',
    'ᵒ': 'o', 'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u', 'ᵛ': 'v',
    'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z',
};
const SUBSCRIPT_MAP: Record<string, string> = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5',
    '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₊': '+', '₋': '-',
    'ₙ': 'n', 'ᵢ': 'i', 'ⱼ': 'j', 'ₓ': 'x',
};
const VULGAR_FRACTIONS: Record<string, string> = {
    '½': ' one half ', '⅓': ' one third ', '⅔': ' two thirds ',
    '¼': ' one quarter ', '¾': ' three quarters ', '⅕': ' one fifth ',
    '⅖': ' two fifths ', '⅗': ' three fifths ', '⅘': ' four fifths ',
    '⅙': ' one sixth ', '⅚': ' five sixths ', '⅛': ' one eighth ',
    '⅜': ' three eighths ', '⅝': ' five eighths ', '⅞': ' seven eighths ',
};
const GREEK_MAP: Record<string, string> = {
    'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon',
    'ζ': 'zeta', 'η': 'eta', 'θ': 'theta', 'ι': 'iota', 'κ': 'kappa',
    'λ': 'lambda', 'μ': 'mu', 'ν': 'nu', 'ξ': 'xi', 'ρ': 'rho',
    'σ': 'sigma', 'τ': 'tau', 'υ': 'upsilon', 'φ': 'phi', 'χ': 'chi',
    'ψ': 'psi', 'ω': 'omega', 'Γ': 'gamma', 'Δ': 'delta', 'Θ': 'theta',
    'Λ': 'lambda', 'Ξ': 'xi', 'Π': 'pi', 'Σ': 'sigma', 'Φ': 'phi',
    'Ψ': 'psi', 'Ω': 'omega',
};

function normalizeUnicodeMath(input: string): string {
    let t = input;

    // --- Common function words typed without LaTeX ---
    t = t.replace(/\bdet\s*\(/gi, ' the determinant of (');
    t = t.replace(/\blog\s*_\s*([0-9a-zA-Z]+)/g, ' log base $1 of ');

    // --- ORDERED PAIRS / COORDINATES ---
    //
    // "(5,6)" reaches the model intact (the sanitiser whitelists commas and
    // brackets), and an English phonemiser treats a comma between digits as a
    // THOUSANDS SEPARATOR -- so "(5,6)" is voiced "fifty-six" and "(2,3)"
    // becomes "twenty-three". Making the separator explicit is the only
    // reliable fix, and "five comma six" is how the pair is read aloud in
    // class anyway.
    //
    // Restricted to bracketed pairs/triples so ordinary list punctuation
    // ("apples, pears, plums") is untouched.
    t = t.replace(
        /([(\[])\s*(-?[\dA-Za-z.]+)\s*,\s*(-?[\dA-Za-z.]+)\s*,\s*(-?[\dA-Za-z.]+)\s*([)\]])/g,
        ' $1 $2 comma $3 comma $4 $5 '
    );
    t = t.replace(
        /([(\[])\s*(-?[\dA-Za-z.]+)\s*,\s*(-?[\dA-Za-z.]+)\s*([)\]])/g,
        ' $1 $2 comma $3 $4 '
    );

    // --- Percent. Kokoro voices a bare "%" inconsistently. ---
    t = t.replace(/(\d)\s*%/g, '$1 percent ');

    // --- Vulgar fractions ---
    t = t.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (m) => VULGAR_FRACTIONS[m] || ' ');

    // --- Superscripts. Run BEFORE the minus rules so "10⁻³" keeps its sign. ---
    t = t.replace(/([A-Za-z0-9)\]])([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿⁱᵃᵇᶜᵈᵉᶠᵍʰʲᵏˡᵐᵒᵖʳˢᵗᵘᵛʷˣʸᶻ]+)/g, (_m, base, sup) => {
        const digits = String(sup).split('').map((c: string) => SUPERSCRIPT_MAP[c] ?? '').join('');
        if (digits === '2') return `${base} squared `;
        if (digits === '3') return `${base} cubed `;
        if (digits.startsWith('-')) return `${base} to the power of negative ${digits.slice(1)} `;
        return `${base} to the power of ${digits} `;
    });

    // --- Subscripts ---
    t = t.replace(/([A-Za-z0-9)\]])([₀₁₂₃₄₅₆₇₈₉₊₋ₙᵢⱼₓ]+)/g, (_m, base, sub) => {
        const digits = String(sub).split('').map((c: string) => SUBSCRIPT_MAP[c] ?? '').join('');
        return `${base} sub ${digits} `;
    });

    // --- Combining marks: x̄ (mean), x̂, x⃗ ---
    // Repeating decimals: 0.3̄ (digit + combining macron)
    t = t.replace(/([0-9])\u0304/g, '$1 repeating ');
    t = t.replace(/([A-Za-z])\u0304/g, ' $1 bar ');
    t = t.replace(/([A-Za-z])\u0302/g, ' $1 hat ');
    t = t.replace(/([A-Za-z])\u20D7/g, ' vector $1 ');

    // --- Prime / complement: A′ ---
    t = t.replace(/([A-Za-z0-9])\u2033/g, '$1 double prime ');
    t = t.replace(/([A-Za-z0-9])\u2032/g, '$1 prime ');

    // --- Radicals ---
    t = t.replace(/∛\s*\(?([A-Za-z0-9.]+)\)?/g, ' the cube root of $1 ');
    t = t.replace(/∜\s*\(?([A-Za-z0-9.]+)\)?/g, ' the fourth root of $1 ');
    t = t.replace(/√\s*\(([^()]{1,40})\)/g, ' the square root of $1 ');
    t = t.replace(/√\s*([A-Za-z0-9.]+)/g, ' the square root of $1 ');
    t = t.replace(/√/g, ' the square root of ');

    // --- Big operators (Unicode, not LaTeX) ---
    t = t.replace(/∑/g, ' the sum of ');
    t = t.replace(/∏/g, ' the product of ');
    t = t.replace(/∫/g, ' the integral of ');
    t = t.replace(/∬/g, ' the double integral of ');
    t = t.replace(/∮/g, ' the contour integral of ');
    // Partial derivatives must run BEFORE the bare ∂ replacement, or the
    // symbol is gone by the time the pattern is tried.
    t = t.replace(/∂\s*([a-zA-Z])\s*\/\s*∂\s*([a-zA-Z])/g,
                  ' the partial derivative of $1 with respect to $2 ');
    t = t.replace(/∂/g, ' partial ');
    t = t.replace(/∇/g, ' del ');
    t = t.replace(/∆/g, ' delta ');

    // --- Geometry / logic symbols ---
    t = t.replace(/∠/g, ' angle ');
    t = t.replace(/⊥/g, ' is perpendicular to ');
    t = t.replace(/∥/g, ' is parallel to ');
    t = t.replace(/≅/g, ' is congruent to ');
    t = t.replace(/∼/g, ' is similar to ');
    t = t.replace(/≡/g, ' is identical to ');
    t = t.replace(/∝/g, ' is proportional to ');
    t = t.replace(/∴/g, ' therefore ');
    t = t.replace(/∵/g, ' because ');
    t = t.replace(/∀/g, ' for all ');
    t = t.replace(/∃/g, ' there exists ');
    t = t.replace(/∆/g, ' triangle ');
    t = t.replace(/⇒/g, ' implies ');
    t = t.replace(/⇔/g, ' if and only if ');
    t = t.replace(/↔/g, ' maps to ');
    t = t.replace(/∖/g, ' minus ');

    // --- Greek letters ---
    t = t.replace(/[αβγδεζηθικλνξρστυφχψωΓΔΘΛΞΠΣΦΨΩμ]/g, (m) =>
        GREEK_MAP[m] ? ` ${GREEK_MAP[m]} ` : ' '
    );

    // --- Comparison operators typed as ASCII ---
    // Bounded so an HTML-ish fragment cannot be mangled: both sides must look
    // like maths operands.
    t = t.replace(/([A-Za-z0-9)\]])\s*<=\s*([A-Za-z0-9(\[-])/g, '$1 is less than or equal to $2');
    t = t.replace(/([A-Za-z0-9)\]])\s*>=\s*([A-Za-z0-9(\[-])/g, '$1 is greater than or equal to $2');
    t = t.replace(/([A-Za-z0-9)\]])\s*<\s*([A-Za-z0-9(\[-])/g, '$1 is less than $2');
    t = t.replace(/([A-Za-z0-9)\]])\s*>\s*([A-Za-z0-9(\[-])/g, '$1 is greater than $2');

    // --- Ratios: "3:4" -> "3 to 4". Guarded against clock times. ---
    t = t.replace(/\b(\d{1,3})\s*:\s*(\d{1,3})\b(?!\s*(?:am|pm|AM|PM))/g, '$1 to $2');

    // --- Degrees, minutes, seconds ---
    t = t.replace(/(\d)\s*°\s*(\d+)\s*['\u2032]\s*(\d+)\s*["\u2033]/g,
                  '$1 degrees $2 minutes $3 seconds ');
    t = t.replace(/(\d)\s*°\s*(\d+)\s*['\u2032]/g, '$1 degrees $2 minutes ');

    // --- UNARY MINUS. This is the reported bug. ---
    //
    // The original rule was  /\s+-\s+/ -> " minus ",  which requires
    // whitespace on BOTH sides. In "(-y, x)" the minus is preceded by "(" and
    // followed by "y", so it never fired and the character was dropped by the
    // downstream sanitiser -- the listener heard "y, x".
    //
    // Convert only in genuinely unary positions: after an opening bracket, a
    // comma, an equals/comparison, or at the very start. Hyphenated words such
    // as "counter-clockwise" and "well-defined" have a LETTER before the
    // hyphen and are therefore untouched.
    t = t.replace(/(^|[(\[{,=<>+\u2013\u2014]|\bis\b|\bequals\b)\s*-\s*(?=[A-Za-z0-9.(])/g,
                  '$1 negative ');

    // Binary minus with spaces (kept from the original behaviour).
    t = t.replace(/(\d|\)|[A-Za-z])\s+-\s+(?=[A-Za-z0-9(])/g, '$1 minus ');

    // Unary minus after a word: "Simplify -5x", "the value -3".
    // Whitespace BEFORE but none AFTER marks it as a sign rather than an
    // operator, so hyphenated words (letter-hyphen-letter) stay untouched.
    t = t.replace(/\s-(?=[A-Za-z0-9(])/g, ' negative ');

    // --- Division slash written inline: a/b, ∑fx/N, 3/4 ---
    // Derivatives first, so dy/dx does not become "d y over d x".
    t = t.replace(/\bd([a-zA-Z])\s*\/\s*d([a-zA-Z])\b/g, ' the derivative of $1 with respect to $2 ');
    t = t.replace(/([A-Za-z0-9)\]])\s*\/\s*([A-Za-z0-9(\[])/g, '$1 over $2');

    // --- Unicode comparison wording, matched to the ASCII forms above ---
    t = t.replace(/\s*≥\s*/g, ' is greater than or equal to ');
    t = t.replace(/\s*≤\s*/g, ' is less than or equal to ');
    t = t.replace(/\s*≠\s*/g, ' is not equal to ');
    t = t.replace(/\s*≈\s*/g, ' is approximately ');

    return t;
}


export function normalizeTextForCartesia(text: string): string {
    let t = text;

    // --- List Processing ---
    let bulletCounter = 1;
    
    // For numbered lists (add a spoken pause by ensuring the previous line ended with a period, and formatting as "1: ")
    t = t.replace(/([.!?])\s*\n\s*(\d+)\.\s+/g, (match, punct, num) => {
        bulletCounter = 1; // reset bullet counter
        return `${punct} ${num}: `;
    });
    t = t.replace(/(^|[^.!?])\s*\n\s*(\d+)\.\s+/g, (match, prevChar, num) => {
        bulletCounter = 1;
        return `${prevChar}. ${num}: `; // Add a period for spoken pause before the number
    });
    t = t.replace(/^\s*(\d+)\.\s+/g, (match, num) => {
        bulletCounter = 1;
        return `${num}: `;
    });
    
    // For bullet lists: replace with "Point X: "
    t = t.replace(/([.!?])\s*\n\s*([-*•])\s+/g, (match, punct) => {
        return `${punct} Point ${bulletCounter++}: `;
    });
    t = t.replace(/(^|[^.!?])\s*\n\s*([-*•])\s+/g, (match, prevChar) => {
        return `${prevChar}. Point ${bulletCounter++}: `; // Add period for pause
    });
    t = t.replace(/^\s*([-*•])\s+/g, () => {
        return `Point ${bulletCounter++}: `;
    });
    
    // Also handle flattened lists (where chunkDocumentText replaced \n with space after a period)
    t = t.replace(/([.!?])\s+([-*•])\s+/g, (match, punct) => {
        return `${punct} Point ${bulletCounter++}: `;
    });
    t = t.replace(/([.!?])\s+(\d+)\.\s+/g, (match, punct, num) => {
        bulletCounter = 1;
        return `${punct} ${num}: `;
    });
    // --- End List Processing ---


    // ---------------------------------------------------------------
    // Unicode cleanup. The ellipsis and curly quotes used to survive to
    // synthesizeKokoroSpeech's whitelist and get deleted there, so
    // "0.333…" lost its "and so on" and "denominator's" became
    // "denominator s".
    // ---------------------------------------------------------------
    t = t.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
    t = t.replace(/\u2026/g, ' and so on ');
    t = t.replace(/[\u2013\u2014]/g, '-');

    // Strip LaTeX delimiters
    t = t.replace(/\$\$(.*?)\$\$/g, ' $1 ');
    t = t.replace(/\$(.*?)\$/g, ' $1 ');
    t = t.replace(/\\\((.*?)\\\)/g, ' $1 ');
    t = t.replace(/\\\[(.*?)\\\]/g, ' $1 ');

    // Acronyms and abbreviations
    t = t.replace(/\bCOVID-19\b/gi, 'Covid nineteen');
    t = t.replace(/\bAI\b/g, 'A.I.');
    t = t.replace(/\be\.g\./gi, 'for example');
    t = t.replace(/\bi\.e\./gi, 'that is');
    t = t.replace(/\betc\./gi, 'etcetera');

    // ---------------------------------------------------------------
    // LaTeX commands that take arguments. Looped because arguments can
    // nest. \overline is what renders a recurring-decimal bar, so it has
    // to become "repeating" rather than being silently dropped.
    // ---------------------------------------------------------------
    for (let pass = 0; pass < 3; pass++) {
        t = t.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, ' $1 over $2 ');
        t = t.replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, ' the $1 root of $2 ');
        t = t.replace(/\\sqrt\{([^{}]*)\}/g, ' the square root of $1 ');
        t = t.replace(/\\overline\{([^{}]*)\}/g, ' $1 repeating ');
        t = t.replace(/\\(?:bar|hat|vec|tilde)\{([^{}]*)\}/g, ' $1 ');
        t = t.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g, ' $1 ');
    }

    // ---------------------------------------------------------------
    // Structured constructs. These MUST run before the symbol catch-all
    // below, which would otherwise delete \lim / \int / \begin and leave
    // their subscripts stranded as "sub h gives 0".
    // ---------------------------------------------------------------

    // Matrix environments -> spoken row/column description.
    t = t.replace(
        /\\begin\{(?:p|b|v|V|small)?matrix\}([\s\S]*?)\\end\{(?:p|b|v|V|small)?matrix\}/g,
        (_m, inner) => {
            const rows = String(inner)
                .split(/\\\\/)
                .map((r: string) => r.trim().split('&').map((x) => x.trim()).filter(Boolean).join(', '))
                .filter(Boolean);
            return ` the matrix with rows ${rows.join('; ')} `;
        }
    );
    t = t.replace(/\\begin\{[^}]*\}/g, ' ').replace(/\\end\{[^}]*\}/g, ' ');
    t = t.replace(/\\\\/g, ' ');   // LaTeX row separator
    t = t.replace(/&/g, ' , ');    // LaTeX column separator

    // Limits
    t = t.replace(/\\lim\s*_\{([^{}]*)\}/g, ' the limit as $1 ');
    t = t.replace(/\\lim\s*_([a-zA-Z0-9]+)/g, ' the limit as $1 ');

    // Definite integrals / sums / products with bounds
    t = t.replace(/\\int\s*_\{([^{}]*)\}\s*\^\{([^{}]*)\}/g, ' the integral from $1 to $2 of ');
    t = t.replace(/\\int\s*_([a-zA-Z0-9]+)\s*\^([a-zA-Z0-9]+)/g, ' the integral from $1 to $2 of ');
    t = t.replace(/\\sum\s*_\{([^{}]*)\}\s*\^\{([^{}]*)\}/g, ' the sum from $1 to $2 of ');
    t = t.replace(/\\sum\s*_([a-zA-Z0-9]+)\s*\^([a-zA-Z0-9]+)/g, ' the sum from $1 to $2 of ');
    t = t.replace(/\\prod\s*_\{([^{}]*)\}\s*\^\{([^{}]*)\}/g, ' the product from $1 to $2 of ');

    // LaTeX spacing commands (\, \; \: \! and escaped space). These are not
    // letter-commands, so the catch-all below never matched them and the raw
    // backslash reached the sanitizer, turning "\,dx" into ",dx".
    t = t.replace(/\\[,;:!]/g, ' ');
    t = t.replace(/\\ /g, ' ');

    // Absolute value / magnitude
    t = t.replace(/\\left\s*\|/g, '|').replace(/\\right\s*\|/g, '|');
    t = t.replace(/\|([^|\n]{1,40})\|/g, ' the absolute value of $1 ');

    // Prime notation: f'(x) -> "f prime of x". Guarded so possessives such as
    // "denominator's" are untouched (the lookahead rejects a following letter,
    // and \b requires the prime to follow a single-letter token).
    t = t.replace(/\b([a-zA-Z])'''(?![a-zA-Z])/g, '$1 triple prime ');
    t = t.replace(/\b([a-zA-Z])''(?![a-zA-Z])/g, '$1 double prime ');
    t = t.replace(/\b([a-zA-Z])'(?![a-zA-Z])/g, '$1 prime ');

    // ---------------------------------------------------------------
    // Symbolic LaTeX commands. The catch-all at the end is important for
    // generality: ANY unrecognised \command becomes a space rather than
    // reaching the model as a literal backslash word, and unlike the old
    // code it can no longer collide with the brace rules below.
    // ---------------------------------------------------------------
    const latexSymbols: Record<string, string> = {
        times: ' times ', cdot: ' times ', div: ' divided by ', pm: ' plus or minus ',
        leq: ' less than or equal to ', le: ' less than or equal to ',
        geq: ' greater than or equal to ', ge: ' greater than or equal to ',
        neq: ' is not equal to ', ne: ' is not equal to ', approx: ' approximately ',
        infty: ' infinity ', pi: ' pi ', theta: ' theta ', alpha: ' alpha ',
        beta: ' beta ', gamma: ' gamma ', Delta: ' delta ', delta: ' delta ',
        lambda: ' lambda ', mu: ' mu ', sigma: ' sigma ', omega: ' omega ',
        rightarrow: ' gives ', to: ' approaches ', leftarrow: ' from ',
        subseteq: ' is a subset of ', subset: ' is a proper subset of ',
        supseteq: ' is a superset of ', in: ' is an element of ',
        notin: ' is not an element of ', cup: ' union ', cap: ' intersection ',
        emptyset: ' the empty set ', varnothing: ' the empty set ',
        sum: ' the sum of ', int: ' the integral of ', prod: ' the product of ',
        therefore: ' therefore ', because: ' because ', degree: ' degrees ',
        log: ' log ', ln: ' natural log ', exp: ' exponential of ',
        sin: ' sine ', cos: ' cosine ', tan: ' tangent ',
        sec: ' secant ', csc: ' cosecant ', cot: ' cotangent ',
        arcsin: ' arc sine ', arccos: ' arc cosine ', arctan: ' arc tangent ',
        sinh: ' hyperbolic sine ', cosh: ' hyperbolic cosine ', tanh: ' hyperbolic tangent ',
        det: ' the determinant of ', deg: ' degree of ', gcd: ' the G C D of ',
        lcm: ' the L C M of ', max: ' the maximum of ', min: ' the minimum of ',
        lim: ' the limit of ', partial: ' partial ', nabla: ' del ',
        quad: ' ', qquad: ' ', dots: ' and so on ', ldots: ' and so on ', cdots: ' and so on ',
        equiv: ' is equivalent to ', propto: ' is proportional to ',
        forall: ' for all ', exists: ' there exists ', implies: ' implies ',
        perp: ' is perpendicular to ', parallel: ' is parallel to ',
        circ: ' degrees ', prime: ' prime '
    };
    t = t.replace(/\\([a-zA-Z]+)/g, (_m, cmd) =>
        latexSymbols[cmd] !== undefined ? latexSymbols[cmd] : ' '
    );

    // Subscripts / superscripts (chemistry: H_2O, CO_2)
    t = t.replace(/\^\{([^{}]*)\}/g, ' to the power of $1 ');
    t = t.replace(/_\{([^{}]*)\}/g, ' sub $1 ');
    t = t.replace(/_([a-zA-Z0-9])/g, ' sub $1 ');

    // Function notation (simple like f(x))
    t = t.replace(/\b([a-zA-Z])\(([a-zA-Z0-9_]+)\)/g, '$1 of $2');

    // Exponents
    t = t.replace(/([a-zA-Z0-9]+)\^2\b/g, '$1 squared');
    t = t.replace(/([a-zA-Z0-9]+)\^3\b/g, '$1 cubed');
    t = t.replace(/([a-zA-Z0-9]+)\^([a-zA-Z0-9]+)/g, '$1 to the power of $2');
    // Bare exponents: a preceding \command was already replaced by a word, so
    // there is now a space before the caret and the rules above cannot fire.
    t = t.replace(/\s\^2\b/g, ' squared ');
    t = t.replace(/\s\^3\b/g, ' cubed ');
    t = t.replace(/\s\^\{([^{}]*)\}/g, ' to the power of $1 ');
    t = t.replace(/\s\^([a-zA-Z0-9-]+)/g, ' to the power of $1 ');

    // Unicode math + set symbols
    t = t.replace(/π/g, ' pi ');
    t = t.replace(/∞/g, ' infinity ');
    t = t.replace(/±/g, ' plus or minus ');
    t = t.replace(/≤/g, ' less than or equal to ');
    t = t.replace(/≥/g, ' greater than or equal to ');
    t = t.replace(/⊆/g, ' is a subset of ');
    t = t.replace(/⊄/g, ' is not a subset of ');
    t = t.replace(/⊂/g, ' is a proper subset of ');
    t = t.replace(/∉/g, ' is not an element of ');
    t = t.replace(/∈/g, ' is an element of ');
    t = t.replace(/∪/g, ' union ');
    t = t.replace(/∩/g, ' intersection ');
    t = t.replace(/∅/g, ' the empty set ');
    t = t.replace(/≠/g, ' is not equal to ');
    t = t.replace(/≈/g, ' is approximately ');
    t = t.replace(/×/g, ' times ');
    t = t.replace(/÷/g, ' divided by ');
    t = t.replace(/→/g, ' gives ');
    t = t.replace(/°/g, ' degrees ');

    // ---------------------------------------------------------------
    // Braces. The previous version turned EVERY {...} into "the set
    // containing ...", which is right for roster notation but wrong for
    // LaTeX grouping -- it made "\overline{3}" speak as "overline the set
    // containing 3". Only comma-separated contents are treated as a set.
    // ---------------------------------------------------------------
    t = t.replace(/\{\s*\}/g, ' the empty set ');
    t = t.replace(/\{([^{}]*)\}/g, (_m, inner) =>
        String(inner).includes(',') ? ` the set containing ${inner} ` : ` ${inner} `
    );

    // Basic math operators
    t = t.replace(/\s*=\s*/g, ' equals ');
    t = t.replace(/\s+\+\s+/g, ' plus ');
    t = t.replace(/\s+-\s+/g, ' minus ');
    t = t.replace(/\s+\/\s+/g, ' divided by ');
    t = t.replace(/\s+\*\s+/g, ' times ');

    // Unicode / typed-maths layer. Runs AFTER the LaTeX rules (so \frac etc.
    // are already words) and BEFORE the final whitespace cleanup.
    t = normalizeUnicodeMath(t);

    // Clean up extra spaces
    t = t.replace(/\s+/g, ' ').trim();

    return t;
}