const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add state to App component
const stateRegex = /const \[isSearchModalOpen, setIsSearchModalOpen\] = useState\(false\);/;
code = code.replace(stateRegex, `const [isFocusMode, setIsFocusMode] = useState(() => localStorage.getItem('readora_focus_mode') === 'true');
  useEffect(() => {
    localStorage.setItem('readora_focus_mode', isFocusMode.toString());
  }, [isFocusMode]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);`);

// Modify Header rendering
const headerRegex = /\{\/\* Top Navigation Header \*\/\}\n\s*<header className="h-16 /;
code = code.replace(headerRegex, `{/* Top Navigation Header */}
      {!isFocusMode && (<header className="h-16 `);

// Add button to header (before Theme toggle)
const themeBtnRegex = /<button\n\s*onClick=\{toggleTheme\}/;
code = code.replace(themeBtnRegex, `<button
            onClick={() => setIsFocusMode(true)}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Enter Focus Mode"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={toggleTheme}`);

// Close header conditional
const headerCloseRegex = /<\/header>/;
code = code.replace(headerCloseRegex, `</header>)}`);

// Add floating Exit button
const offlineRegex = /\{isOffline && \(/;
code = code.replace(offlineRegex, `{isFocusMode && (
        <button
          onClick={() => setIsFocusMode(false)}
          className="fixed top-4 right-4 z-50 p-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-black/80 transition-all shadow-xl shadow-black/50"
          title="Exit Focus Mode"
        >
          <Minimize2 className="w-5 h-5" />
        </button>
      )}
      {isOffline && (`);

// Hide Sidebar when in focus mode
const sidebarDivRegex = /<div className=\{cn\(\n\s*"absolute md:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out flex",\n\s*isSidebarOpen \? "translate-x-0" : "-translate-x-full",\n\s*!isSidebarOpen && !isDesktopSidebarCollapsed \? "md:translate-x-0" : "",\n\s*isDesktopSidebarCollapsed \? "md:hidden" : ""\n\s*\)\}>/;
code = code.replace(sidebarDivRegex, `<div className={cn(
          "absolute md:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out flex",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          !isSidebarOpen && !isDesktopSidebarCollapsed ? "md:translate-x-0" : "",
          isDesktopSidebarCollapsed || isFocusMode ? "md:hidden" : ""
        )}>`);

// Pass isFocusMode to ChatArea
const chatAreaRegex = /<ChatArea \n\s*chapter=\{activeChapter\}/;
code = code.replace(chatAreaRegex, `<ChatArea 
                isFocusMode={isFocusMode}
                chapter={activeChapter}`);

// Pass isFocusMode to DocumentReader
const docReaderRegex = /<DocumentReader document=\{sharedPublicDoc\} initialScrollChapterId=\{initialScrollChapterId\} \/>/;
code = code.replace(docReaderRegex, `<DocumentReader isFocusMode={isFocusMode} document={sharedPublicDoc} initialScrollChapterId={initialScrollChapterId} />`);
const docReaderRegex2 = /<DocumentReader document=\{selectedDoc\} initialScrollChapterId=\{initialScrollChapterId\} \/>/;
code = code.replace(docReaderRegex2, `<DocumentReader isFocusMode={isFocusMode} document={selectedDoc} initialScrollChapterId={initialScrollChapterId} />`);

fs.writeFileSync('src/App.tsx', code);
