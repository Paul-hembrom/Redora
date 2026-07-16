import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("Maximize")) {
  code = code.replace("import { BookOpen, LogOut, User as UserIcon, Menu, X, Search, UploadCloud, Sun, Moon, Lock, RefreshCw, Loader2 } from 'lucide-react';", "import { BookOpen, LogOut, User as UserIcon, Menu, X, Search, UploadCloud, Sun, Moon, Lock, RefreshCw, Loader2, Maximize, Minimize, PanelLeftClose, PanelLeftOpen } from 'lucide-react';");
}

if (!code.includes("isDesktopSidebarCollapsed")) {
  const stateStr = `  const [isSidebarOpen, setIsSidebarOpen] = useState(false);`;
  const newStateStr = `  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isDesktopSidebarCollapsed.toString());
  }, [isDesktopSidebarCollapsed]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(err => console.error(err));
      setIsDesktopSidebarCollapsed(true);
    } else {
      await document.exitFullscreen().catch(err => console.error(err));
    }
  };`;
  code = code.replace(stateStr, newStateStr);
}

const toggleButtonStr = `<button 
            className="md:hidden p-2 -ml-2 text-white/70 hover:text-white transition-colors"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>`;
const newToggleButtonStr = `<button 
            className="md:hidden p-2 -ml-2 text-white/70 hover:text-white transition-colors"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <button 
            className="hidden md:flex p-2 -ml-2 text-white/70 hover:text-white transition-colors"
            onClick={() => setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)}
            title={isDesktopSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isDesktopSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>`;
if (code.includes(toggleButtonStr) && !code.includes("isDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)")) {
  code = code.replace(toggleButtonStr, newToggleButtonStr);
}

// Fullscreen button inside main content area
const flexContainerStr = `<div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-0">`;
const newFlexContainerStr = `<div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-0 group/main">
          {isFullscreen ? (
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white/70 hover:text-white border border-white/10 px-4 py-2 rounded-full shadow-lg transition-all"
            >
              <Minimize className="w-4 h-4" />
              <span className="text-sm font-medium">Exit Full Screen</span>
            </button>
          ) : (
            <button
              onClick={toggleFullscreen}
              className="absolute top-3 right-4 z-50 p-2 bg-black/40 hover:bg-black/60 backdrop-blur text-white/70 hover:text-white border border-white/5 rounded-lg shadow-lg opacity-0 group-hover/main:opacity-100 focus:opacity-100 transition-all pointer-events-none group-hover/main:pointer-events-auto focus:pointer-events-auto"
              title="Full Screen"
            >
              <Maximize className="w-4 h-4" />
            </button>
          )}`;

if (code.includes(flexContainerStr) && !code.includes("isFullscreen ? (")) {
  code = code.replace(flexContainerStr, newFlexContainerStr);
}

// Also change the Sidebar wrapper to handle collapsing
const sidebarWrapperStr = `<div className={\`absolute md:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out flex \${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}\`}>`;
const newSidebarWrapperStr = `<div className={\`absolute md:static inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out flex \${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} \${isDesktopSidebarCollapsed ? 'md:-translate-x-full md:w-0 overflow-hidden md:opacity-0 md:pointer-events-none' : 'md:w-80 md:opacity-100'}\`}>
          <div className="w-80 shrink-0 h-full">`;
          
if (code.includes(sidebarWrapperStr) && !code.includes("isDesktopSidebarCollapsed ?")) {
  code = code.replace(sidebarWrapperStr, newSidebarWrapperStr);
  
  // Need to close the new wrapper div inside. Let's find the end of Sidebar
  const sidebarClosingStr = `setTerminologyDoc(doc);
              setIsTerminologyModalOpen(true);
            }}
          />
        </div>`;
  const newSidebarClosingStr = `setTerminologyDoc(doc);
              setIsTerminologyModalOpen(true);
            }}
          />
          </div>
        </div>`;
  code = code.replace(sidebarClosingStr, newSidebarClosingStr);
}


fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx successfully");
