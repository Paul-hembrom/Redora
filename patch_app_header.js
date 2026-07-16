import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const headerButtonOld = `<button 
            className="hidden md:flex p-2 -ml-2 text-white/70 hover:text-white transition-colors"
            onClick={() => setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)}
            title={isDesktopSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isDesktopSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>`;

if (code.includes(headerButtonOld)) {
  code = code.replace(headerButtonOld, "");
  fs.writeFileSync('src/App.tsx', code);
  console.log("Removed header button.");
} else {
  console.log("Could not find header button.");
}
