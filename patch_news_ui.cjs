const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const oldNewsUI = `{msg.news.map((item, nIdx) => (
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
                      ))}`;

const newNewsUI = `{msg.news.map((item, nIdx) => (
                        <div key={nIdx} className="bg-white/5 border border-white/10 rounded-lg overflow-hidden flex flex-col">
                          <div className="p-3 flex flex-col flex-1">
                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-white line-clamp-2 hover:text-cyan-400 transition-colors mb-2" title={item.title}>
                              {item.title}
                            </a>
                            <p className="text-xs text-white/50 mb-2 truncate">
                              {item.source} {item.date ? \`· \${item.date}\` : ''}
                            </p>
                            <p className="text-xs text-white/70 italic line-clamp-3 flex-1">{item.snippet}</p>
                          </div>
                        </div>
                      ))}`;

code = code.replace(oldNewsUI, newNewsUI);
fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Updated news UI");
