const fs = require('fs');

// Patch App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

const stateTarget = `  const [isFocusMode, setIsFocusMode] = useState(() => localStorage.getItem('readora_focus_mode') === 'true');
  useEffect(() => {
    localStorage.setItem('readora_focus_mode', isFocusMode.toString());
  }, [isFocusMode]);`;
const stateReplacement = `  const [isFocusMode, setIsFocusMode] = useState(() => localStorage.getItem('readora_focus_mode') === 'true');
  const [focusFontSize, setFocusFontSize] = useState(() => localStorage.getItem('readora_focus_font_size') || 'xl');
  useEffect(() => {
    localStorage.setItem('readora_focus_mode', isFocusMode.toString());
  }, [isFocusMode]);
  useEffect(() => {
    localStorage.setItem('readora_focus_font_size', focusFontSize);
  }, [focusFontSize]);`;
appCode = appCode.replace(stateTarget, stateReplacement);

const propsTarget1 = `<DocumentReader isFocusMode={isFocusMode} document={sharedPublicDoc}`;
const propsReplacement1 = `<DocumentReader isFocusMode={isFocusMode} focusFontSize={focusFontSize} document={sharedPublicDoc}`;
appCode = appCode.replace(propsTarget1, propsReplacement1);

const propsTarget2 = `<DocumentReader isFocusMode={isFocusMode} document={selectedDoc}`;
const propsReplacement2 = `<DocumentReader isFocusMode={isFocusMode} focusFontSize={focusFontSize} document={selectedDoc}`;
appCode = appCode.replace(propsTarget2, propsReplacement2);

const propsTarget3 = `isFocusMode={isFocusMode}
                chapter={activeChapter}`;
const propsReplacement3 = `isFocusMode={isFocusMode}
                focusFontSize={focusFontSize}
                chapter={activeChapter}`;
appCode = appCode.replace(propsTarget3, propsReplacement3);

const buttonTarget = `{isFocusMode && (
        <button
          onClick={() => setIsFocusMode(false)}
          className="fixed top-4 right-4 z-50 w-12 h-12 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-black/80 transition-all shadow-xl shadow-black/50"
          title="Exit Focus Mode"
        >
          <Minimize2 className="w-5 h-5" />
        </button>
      )}`;
const buttonReplacement = `{isFocusMode && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 p-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 shadow-xl shadow-black/50">
          <div className="flex items-center gap-2 px-3 text-white/60">
            <span className="text-xs font-semibold">A</span>
            <input 
              type="range" 
              min="0" 
              max="2" 
              step="1"
              value={focusFontSize === 'base' ? 0 : focusFontSize === 'lg' ? 1 : 2}
              onChange={(e) => {
                const val = e.target.value;
                setFocusFontSize(val === '0' ? 'base' : val === '1' ? 'lg' : 'xl');
              }}
              className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              title="Adjust Font Size"
            />
            <span className="text-lg font-semibold">A</span>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <button
            onClick={() => setIsFocusMode(false)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
            title="Exit Focus Mode"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      )}`;
appCode = appCode.replace(buttonTarget, buttonReplacement);
fs.writeFileSync('src/App.tsx', appCode);

// Patch ChatArea.tsx
let chatCode = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');
chatCode = chatCode.replace(/isFocusMode\?: boolean;/, 'isFocusMode?: boolean;\n  focusFontSize?: string;');
chatCode = chatCode.replace(/isFocusMode, chapter/, 'isFocusMode, focusFontSize = "xl", chapter');
chatCode = chatCode.replace(/isFocusMode \? "prose-xl" : "prose-sm"/g, 'isFocusMode ? `prose-${focusFontSize}` : "prose-sm"');
fs.writeFileSync('src/components/ChatArea.tsx', chatCode);

// Patch DocumentReader.tsx
let docCode = fs.readFileSync('src/components/DocumentReader.tsx', 'utf8');
docCode = docCode.replace(/isFocusMode\?: boolean;/, 'isFocusMode?: boolean;\n  focusFontSize?: string;');
docCode = docCode.replace(/isFocusMode, document/, 'isFocusMode, focusFontSize = "xl", document');
docCode = docCode.replace(/isFocusMode \? "prose-xl" : "prose-sm"/g, 'isFocusMode ? `prose-${focusFontSize}` : "prose-sm"');
fs.writeFileSync('src/components/DocumentReader.tsx', docCode);

