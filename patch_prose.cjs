const fs = require('fs');

let docCode = fs.readFileSync('src/components/DocumentReader.tsx', 'utf8');

docCode = docCode.replace(
  /className=\{cn\("prose prose-invert max-w-none text-white\/70 font-light", isFocusMode \? `prose-\$\{focusFontSize\}` : "prose-sm"\)\}/g,
  'className={cn("prose prose-invert max-w-none text-white/70 font-light", isFocusMode ? `prose-${focusFontSize} focus-mode-text` : "prose-sm")}'
);

docCode = docCode.replace(
  /className=\{cn\("prose prose-invert max-w-none text-white\/80 font-serif leading-relaxed markdown-body", isFocusMode \? `prose-\$\{focusFontSize\}` : ""\)\}/g,
  'className={cn("prose prose-invert max-w-none text-white/80 font-serif leading-relaxed markdown-body", isFocusMode ? `prose-${focusFontSize} focus-mode-text` : "")}'
);

fs.writeFileSync('src/components/DocumentReader.tsx', docCode);

let chatCode = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

chatCode = chatCode.replace(
  /className=\{cn\("prose prose-invert max-w-none text-white\/70 leading-relaxed font-light break-words", isFocusMode \? `prose-\$\{focusFontSize\}` : "prose-sm"\)\}/g,
  'className={cn("prose prose-invert max-w-none text-white/70 leading-relaxed font-light break-words", isFocusMode ? `prose-${focusFontSize} focus-mode-text` : "prose-sm")}'
);

chatCode = chatCode.replace(
  /className=\{cn\("prose prose-invert max-w-none text-white\/90 leading-relaxed font-serif whitespace-pre-wrap rounded-xl bg-white\/\[0\.02\] border border-white\/5 p-6 break-words", isFocusMode \? `prose-\$\{focusFontSize\}` : "prose-sm"\)\}/g,
  'className={cn("prose prose-invert max-w-none text-white/90 leading-relaxed font-serif whitespace-pre-wrap rounded-xl bg-white/[0.02] border border-white/5 p-6 break-words", isFocusMode ? `prose-${focusFontSize} focus-mode-text` : "prose-sm")}'
);

chatCode = chatCode.replace(
  /className=\{cn\("prose prose-invert max-w-none font-light leading-relaxed break-words", isFocusMode \? `prose-\$\{focusFontSize\}` : "prose-sm"\)\}/g,
  'className={cn("prose prose-invert max-w-none font-light leading-relaxed break-words", isFocusMode ? `prose-${focusFontSize} focus-mode-text` : "prose-sm")}'
);

fs.writeFileSync('src/components/ChatArea.tsx', chatCode);

