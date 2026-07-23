const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const newsButton = `                <button 
                  onClick={handleFetchNews} 
                  disabled={isTyping}
                  className="text-xs font-medium px-3 py-1.5 rounded-md text-white/60 hover:text-blue-400 hover:bg-white/5 transition-colors flex items-center gap-1.5 shrink-0" 
                  title="Find news articles"
                >
                  <Newspaper className="w-3.5 h-3.5" /> Find News
                </button>
`;

if (!code.includes('<Newspaper')) {
    code = code.replace("<SerperImageSearch", newsButton + "                <SerperImageSearch");
    fs.writeFileSync('src/components/ChatArea.tsx', code);
    console.log("Added Find News button");
} else {
    console.log("Find News button exists");
}
