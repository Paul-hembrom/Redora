const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

css = css.replace(/@layer utilities \{\n@layer utilities \{/g, '@layer utilities {');
fs.writeFileSync('src/index.css', css);
