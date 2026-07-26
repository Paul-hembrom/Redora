const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `<div className={cn("flex items-center shrink-0 gap-1.5 bg-black/40 p-1 rounded-lg border border-white/5 pr-2", isOffline && "opacity-50 pointer-events-none")}>`;

const replacement = `{!isFocusMode && (
          <div className={cn("flex items-center shrink-0 gap-1.5 bg-black/40 p-1 rounded-lg border border-white/5 pr-2", isOffline && "opacity-50 pointer-events-none")}>`;

code = code.replace(target, replacement);

const targetEnd = `              <CloudDownload className="w-3.5 h-3.5" /> Save Offline
            </button>
            )}
          </ScrollableActionBar>`;

const replacementEnd = `              <CloudDownload className="w-3.5 h-3.5" /> Save Offline
            </button>
            )}
          </div>
          )}
          </ScrollableActionBar>`;
code = code.replace(targetEnd, replacementEnd);

fs.writeFileSync('src/components/ChatArea.tsx', code);
