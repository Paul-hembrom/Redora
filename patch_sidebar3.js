import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldWrapper = "<div className={`absolute md:static inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out flex ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isDesktopSidebarCollapsed ? 'md:-translate-x-full md:w-0 overflow-hidden md:opacity-0 md:pointer-events-none' : 'md:translate-x-0 md:w-80 md:opacity-100'}`}>\n          <Sidebar";

const newWrapper = "<div className={`absolute md:static inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out flex shrink-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isDesktopSidebarCollapsed ? 'md:-translate-x-full md:w-0 overflow-hidden md:opacity-0 md:pointer-events-none' : 'md:translate-x-0 md:w-80 md:opacity-100'}`}>\n          <div className=\"w-80 shrink-0 flex\">\n            <Sidebar";

if (code.includes(oldWrapper)) {
  code = code.replace(oldWrapper, newWrapper);
  
  // Need to close the new div. Let's replace the end of Sidebar wrapper.
  const oldEnd = "setIsTerminologyModalOpen(true);\n            }}\n          />\n        </div>";
  const newEnd = "setIsTerminologyModalOpen(true);\n            }}\n          />\n          </div>\n        </div>";
  
  if (code.includes(oldEnd)) {
    code = code.replace(oldEnd, newEnd);
    fs.writeFileSync('src/App.tsx', code);
    console.log("Patched App.tsx sidebar wrapper completely.");
  } else {
    console.log("Could not find oldEnd.");
  }
} else {
  console.log("Could not find oldWrapper.");
}
