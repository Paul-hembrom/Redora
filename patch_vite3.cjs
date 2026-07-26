const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');

const regexStr = `/(<script type="module" crossorigin src="\\/assets\\/index-[^"]+\\.js)("><\\/script>)/`;
code = code.replace(/\/\(<script type="module" crossorigin src="\/assets\/index-\[\^"\]\+\.js\)\("><\/script>\)\//, regexStr);

fs.writeFileSync('vite.config.ts', code);
