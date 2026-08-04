const fs = require('fs');
let chat = fs.readFileSync('src/components/ChatArea.tsx', 'utf-8');

const targetButton = `{canGenerateVideo && (
                  <button 
                    onClick={handleGenerateVideoLesson} 
                    className="text-xs font-medium px-3 py-1.5 rounded-md text-white/60 hover:text-indigo-400 hover:bg-white/5 transition-colors flex items-center gap-1.5 shrink-0"
                    title="Generate AI video lesson"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> Generate Video <BetaBadge />
                  </button>
                )}`;

chat = chat.replace(targetButton, '');
fs.writeFileSync('src/components/ChatArea.tsx', chat);
console.log("Removed button");
