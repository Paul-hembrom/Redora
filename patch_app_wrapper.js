import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldWrapper = "<div className={`absolute md:static inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out flex shrink-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isDesktopSidebarCollapsed ? 'md:-translate-x-full md:w-0 overflow-hidden md:opacity-0 md:pointer-events-none' : 'md:translate-x-0 md:w-80 md:opacity-100'}`}>";
const newWrapper = `        <button
          onClick={() => setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)}
          className={\`hidden md:flex absolute top-1/2 -translate-y-1/2 z-[60] items-center justify-center w-6 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 shadow-xl transition-all duration-300 \${isDesktopSidebarCollapsed ? 'left-0 rounded-r-md border-l-0' : 'left-80 rounded-l-md border-r-0'}\`}
          title={isDesktopSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isDesktopSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4 text-white" /> : <PanelLeftClose className="w-4 h-4 text-white" />}
        </button>
        <div className={\`absolute md:static inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out flex shrink-0 \${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} \${isDesktopSidebarCollapsed ? 'md:w-0 overflow-hidden md:opacity-0 md:pointer-events-none' : 'md:w-80 md:opacity-100'}\`}>`;

if (code.includes(oldWrapper)) {
  code = code.replace(oldWrapper, newWrapper);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched App.tsx sidebar wrapper classes and added floating button.");
} else {
  console.log("Could not find oldWrapper.");
}
