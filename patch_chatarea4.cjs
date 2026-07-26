const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// 1. replace literal string "flex gap-3 md:gap-6 max-w-4xl mx-auto w-full"
code = code.replace(/className="flex gap-3 md:gap-6 max-w-4xl mx-auto w-full"/g, 'className={cn("flex gap-3 md:gap-6 w-full", isFocusMode ? "max-w-none px-4 md:px-12 mx-auto" : "max-w-4xl mx-auto")}');

// 2. replace inside cn()
code = code.replace(/className=\{cn\("flex gap-3 md:gap-6 max-w-4xl mx-auto w-full group",/g, 'className={cn("flex gap-3 md:gap-6 w-full group", isFocusMode ? "max-w-none px-4 md:px-12 mx-auto" : "max-w-4xl mx-auto",');

// 3. Error alert
code = code.replace(/className="max-w-4xl mx-auto w-full p-5 rounded-xl bg-red-500\/10/g, 'className={cn("w-full p-5 rounded-xl bg-red-500/10", isFocusMode ? "max-w-none px-4 md:px-12 mx-auto" : "max-w-4xl mx-auto", "border border-red-500/20 text-red-400 text-sm flex flex-col items-start gap-3 shadow-sm")}');

// 4. Input wrapper
code = code.replace(/<div className="max-w-4xl mx-auto">/g, '<div className={cn("transition-all duration-300", isFocusMode ? "max-w-none px-4 md:px-12 mx-auto w-full" : "max-w-4xl mx-auto")}>');

// 5. Prose classes
code = code.replace(/className="prose prose-invert prose-sm max-w-none/g, 'className={cn("prose prose-invert max-w-none", isFocusMode ? "prose-xl" : "prose-sm")}');

fs.writeFileSync('src/components/ChatArea.tsx', code);
