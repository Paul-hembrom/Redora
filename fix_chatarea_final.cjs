const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `              </>
            )}
            {!isFocusMode && (
            <button 
              onClick={async () => {
                const lib = await import('../lib/offline');
                await lib.cacheWholeTopic(chapter);
                alert('Chapter is now available offline');
              }} 
              className="text-xs font-medium px-3 py-1.5 rounded-md text-white/60 hover:text-cyan-400 hover:bg-white/5 transition-colors flex items-center gap-1.5 shrink-0" 
              title="Make available offline"
            >
              <CloudDownload className="w-3.5 h-3.5" /> Save Offline
            </button>
          </div>
          <button`;

const replacement = `              </>
            )}
            <button 
              onClick={async () => {
                const lib = await import('../lib/offline');
                await lib.cacheWholeTopic(chapter);
                alert('Chapter is now available offline');
              }} 
              className="text-xs font-medium px-3 py-1.5 rounded-md text-white/60 hover:text-cyan-400 hover:bg-white/5 transition-colors flex items-center gap-1.5 shrink-0" 
              title="Make available offline"
            >
              <CloudDownload className="w-3.5 h-3.5" /> Save Offline
            </button>
          </div>
          )}
          <button`;
code = code.replace(target, replacement);

fs.writeFileSync('src/components/ChatArea.tsx', code);
