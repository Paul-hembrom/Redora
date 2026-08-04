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

    // Clean up extra spaces
    t = t.replace(/\s+/g, ' ').trim();

    return t;
}
