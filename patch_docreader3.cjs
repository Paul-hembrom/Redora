const fs = require('fs');
let code = fs.readFileSync('src/components/DocumentReader.tsx', 'utf8');

// Replace max-w-4xl
code = code.replace(/className="max-w-4xl mx-auto space-y-16"/g, 'className={cn("space-y-16", isFocusMode ? "max-w-none px-4 md:px-12 mx-auto" : "max-w-4xl mx-auto")}');

// Replace prose classes to add prose-xl when isFocusMode is true
code = code.replace(/className="prose prose-invert prose-sm max-w-none text-white\/70 font-light"/g, 'className={cn("prose prose-invert max-w-none text-white/70 font-light", isFocusMode ? "prose-xl" : "prose-sm")}');

code = code.replace(/className="prose prose-invert max-w-none text-white\/80 font-serif leading-relaxed markdown-body"/g, 'className={cn("prose prose-invert max-w-none text-white/80 font-serif leading-relaxed markdown-body", isFocusMode ? "prose-2xl" : "")}');

// Also need to import cn if it's not imported
if (!code.includes('import { cn }')) {
  code = code.replace(/import \{ ReadAloudButton \}/, "import { cn } from '../lib/utils';\nimport { ReadAloudButton }");
}

fs.writeFileSync('src/components/DocumentReader.tsx', code);
