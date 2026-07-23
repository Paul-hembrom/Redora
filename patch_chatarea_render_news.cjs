const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const newsBlock = `                {msg.news && msg.news.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-6 text-left"
                  >
                    <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2 mb-4">
                      <Newspaper className="w-4 h-4" /> Latest News
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {msg.news.map((item, nIdx) => (
                        <a key={nIdx} href={item.link} target="_blank" rel="noopener noreferrer" className="block bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-white/10 rounded-lg overflow-hidden flex flex-col transition-colors">
                          <div className="p-4 flex flex-col flex-1">
                            <h4 className="text-sm font-medium text-white line-clamp-2 mb-2" title={item.title}>{item.title}</h4>
                            <p className="text-xs text-white/50 mb-3 truncate flex items-center justify-between">
                               <span>{item.source}</span>
                               <span>{item.date}</span>
                            </p>
                            <p className="text-xs text-white/70 italic line-clamp-3 flex-1">{item.snippet}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
`;

if (!code.includes('msg.news && msg.news.length > 0')) {
    code = code.replace("{msg.recommended_videos && msg.recommended_videos.length > 0 && (", newsBlock + "\n                {msg.recommended_videos && msg.recommended_videos.length > 0 && (");
    fs.writeFileSync('src/components/ChatArea.tsx', code);
    console.log("Added news render block");
} else {
    console.log("News render block exists");
}
