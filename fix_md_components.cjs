const fs = require('fs');
let code = fs.readFileSync('src/components/MarkdownComponents.tsx', 'utf8');

// Use useId hook from React
code = code.replace(/import React, \{ useState \} from 'react';/, "import React, { useState, useId } from 'react';");

code = code.replace(/const TableWrapper = \(\{ node, children, \.\.\.props \}: any\) => \{/, "const TableWrapper = ({ node, children, ...props }: any) => {\n  const uniqueId = useId().replace(/:/g, '');");

code = code.replace(/id=\{\`tts-explanation-\\\$\\{Math\.random\(\)\.toString\(36\)\.slice\(2, 9\)\\}-0\`\}/, "id={`tts-explanation-${uniqueId}-0`}");

code = code.replace(/<ReadAloudButton\s+text=\{explanation\}/, "<ReadAloudButton \n                      idPrefix={`tts-explanation-${uniqueId}-`}\n                      text={explanation}");

fs.writeFileSync('src/components/MarkdownComponents.tsx', code);
console.log("fixed MarkdownComponents");
