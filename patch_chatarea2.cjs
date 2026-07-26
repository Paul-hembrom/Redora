const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `<div className={cn("flex items-center shrink-0 gap-1.5 bg-black/40 p-1 rounded-lg border border-white/5 pr-2", isOffline && "opacity-50 pointer-events-none")}>
            <button onClick={handleFetchVideos}`;

const replacement = `{!isFocusMode && (
          <div className={cn("flex items-center shrink-0 gap-1.5 bg-black/40 p-1 rounded-lg border border-white/5 pr-2", isOffline && "opacity-50 pointer-events-none")}>
            <button onClick={handleFetchVideos}`;

code = code.replace(target, replacement);

const targetEnd = `              </>
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
            )}
          </ScrollableActionBar>
        </div>
      </div>`;

const replacementEnd = `              </>
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
          </ScrollableActionBar>
        </div>
      </div>`;
code = code.replace(targetEnd, replacementEnd);
// Also remove the `{!isFocusMode && !(isStudent && isSummary) && (` that I incorrectly added in patch_chatarea.cjs
code = code.replace(`{!isFocusMode && !(isStudent && isSummary) && (
              <>
                <button onClick={handleGenerateFlashcards}`, `{!isStudent && !isSummary && (
              <>
                <button onClick={handleGenerateFlashcards}`);
                
// Actually, earlier I matched `{!isFocusMode && !(isStudent && isSummary) && (` in my patch_chatarea.cjs. Let's look at exactly what I replaced.
fs.writeFileSync('patch_chatarea2.cjs_done', 'true');
