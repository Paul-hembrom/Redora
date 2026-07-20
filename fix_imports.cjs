const fs = require('fs');
let code = fs.readFileSync('src/components/MarkdownComponents.tsx', 'utf8');

code = code.replace(/import React, \{ useState \} from 'react';/, "import React, { useState, useId } from 'react';");

fs.writeFileSync('src/components/MarkdownComponents.tsx', code);
console.log("fixed imports");
