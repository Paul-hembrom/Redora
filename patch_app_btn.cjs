const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `className="fixed top-4 right-4 z-50 p-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-black/80 transition-all shadow-xl shadow-black/50"`;

const replacement = `className="fixed top-4 right-4 z-50 w-12 h-12 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-black/80 transition-all shadow-xl shadow-black/50"`;

code = code.replace(target, replacement);
fs.writeFileSync('src/App.tsx', code);
