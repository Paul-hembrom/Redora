const fs = require('fs');
let code = fs.readFileSync('src/components/MarkdownComponents.tsx', 'utf8');

code = code.replace(
    /<div className="text-white\/80 text-sm leading-relaxed pr-10">/,
    `<div id={\`tts-explanation-\${uniqueId}-0\`} className="text-white/80 text-sm leading-relaxed pr-10">`
);

// ALSO, remove any other stray tts-explanation ids just in case:
code = code.replace(/id=\{\`tts-explanation-[a-z0-9]+-0\`\} id=\{/, "id={");

fs.writeFileSync('src/components/MarkdownComponents.tsx', code);
console.log("fixed MarkdownComponents ID");
