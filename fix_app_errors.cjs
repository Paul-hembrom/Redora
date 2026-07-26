const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Fix line 505: `</header>)}` -> `</header>`
code = code.replace(/<\/header>\)}/g, '</header>');

// The real header we wanted to wrap is around line 842: `{/* Top Navigation Header */}`
// Wait, `{!isFocusMode && (<header className="h-16 border-b border-white/5 flex items-center justify-between px-6 shrink-0 bg-[#0a0a0a]">` is now what we have.
const incorrectHeaderRegex = /\{\/\* Top Navigation Header \*\/\}\n\s*\{\!isFocusMode && \(<header className="h-16 /;
// Ah, my initial patch did: `code.replace(headerRegex, "{/* Top Navigation Header */}\n      {!isFocusMode && (<header className=\"h-16 ");`

// Let's replace `{!isFocusMode && (<header className="h-16 ` with `<header className="h-16 ` everywhere to reset it.
code = code.replace(/\{\!isFocusMode && \(<header className="h-16 /g, '<header className="h-16 ');

// Now let's carefully wrap the Top Navigation Header
const topNavTarget = `{/* Top Navigation Header */}
      <header className="h-16 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md`;
const topNavReplacement = `{/* Top Navigation Header */}
      {!isFocusMode && (
      <header className="h-16 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md`;
code = code.replace(topNavTarget, topNavReplacement);

// And close it correctly around line 896
// I'll find `<LogOut className="w-4 h-4" />
//            <span className="hidden sm:inline">Sign Out</span>
//          </button>
//        </div>
//      </header>
//
//      {isFocusMode && (`
const headerEndTarget = `            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>`;
const headerEndReplacement = `            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>
      )}`;
code = code.replace(headerEndTarget, headerEndReplacement);

fs.writeFileSync('src/App.tsx', code);
