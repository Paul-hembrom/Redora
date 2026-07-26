const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// Fix 1223
code = code.replace(/className=\{cn\("prose prose-invert max-w-none", isFocusMode \? "prose-xl" : "prose-sm"\)\} text-white\/70 leading-relaxed font-light break-words"/g, 'className={cn("prose prose-invert max-w-none text-white/70 leading-relaxed font-light break-words", isFocusMode ? "prose-xl" : "prose-sm")}');

// Fix 1260
code = code.replace(/className=\{cn\("prose prose-invert max-w-none", isFocusMode \? "prose-xl" : "prose-sm"\)\} text-white\/90 leading-relaxed font-serif whitespace-pre-wrap rounded-xl bg-white\/\[0\.02\] border border-white\/5 p-6 break-words"/g, 'className={cn("prose prose-invert max-w-none text-white/90 leading-relaxed font-serif whitespace-pre-wrap rounded-xl bg-white/[0.02] border border-white/5 p-6 break-words", isFocusMode ? "prose-xl" : "prose-sm")}');

// Fix 1388
code = code.replace(/className=\{cn\("prose prose-invert max-w-none", isFocusMode \? "prose-xl" : "prose-sm"\)\} font-light leading-relaxed break-words"/g, 'className={cn("prose prose-invert max-w-none font-light leading-relaxed break-words", isFocusMode ? "prose-xl" : "prose-sm")}');

// Fix 1576
code = code.replace(/className=\{cn\("w-full p-5 rounded-xl bg-red-500\/10", isFocusMode \? "max-w-none px-4 md:px-12 mx-auto" : "max-w-4xl mx-auto", "border border-red-500\/20 text-red-400 text-sm flex flex-col items-start gap-3 shadow-sm"\)\} border border-red-500\/20 text-red-400 text-sm flex flex-col items-start gap-3 shadow-sm"/g, 'className={cn("w-full p-5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex flex-col items-start gap-3 shadow-sm", isFocusMode ? "max-w-none px-4 md:px-12 mx-auto" : "max-w-4xl mx-auto")}');

fs.writeFileSync('src/components/ChatArea.tsx', code);
