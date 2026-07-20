const fs = require('fs');
let code = fs.readFileSync('src/components/MarkdownComponents.tsx', 'utf8');

// Add uniqueId to AnswerWrapper
code = code.replace(
    /const AnswerWrapper = \(\{ node, children, \.\.\.props \}: any\) => \{/,
    `const AnswerWrapper = ({ node, children, ...props }: any) => {
  const uniqueId = useId().replace(/:/g, '');`
);

// We need to import useId if not already
if (!code.includes('useId')) {
    code = code.replace(/import React, \{ useState \}/, "import React, { useState, useId }");
}

fs.writeFileSync('src/components/MarkdownComponents.tsx', code);
console.log("fixed MarkdownComponents uniqueId");
