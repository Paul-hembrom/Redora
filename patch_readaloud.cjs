const fs = require('fs');

let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf-8');

// 1. Remove MATH_ALIASES block
code = code.replace(/const MATH_ALIASES: Record<string, string\[\]> = \{[\s\S]*?\};\n\n/, '');

// 2. Add import for PHONETIC_TRANSFORMATIONS
code = code.replace(
    /(import \{ [\s\S]*? \} from 'lucide-react';)/,
    "$1\nimport { PHONETIC_TRANSFORMATIONS } from '../lib/ttsDictionary';"
);

// 3. Update the usage
code = code.replace(/MATH_ALIASES\[/g, 'PHONETIC_TRANSFORMATIONS[');

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
