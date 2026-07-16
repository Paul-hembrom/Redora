import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldWrapper = `        <div className={\`absolute md:static inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out flex shrink-0 \${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} \${isDesktopSidebarCollapsed ? 'md:-translate-x-full md:w-0 overflow-hidden md:opacity-0 md:pointer-events-none' : 'md:translate-x-0 md:w-80 md:opacity-100'}\`}>`;

const newWrapper = `        <div className={\`absolute md:relative inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out flex shrink-0 \${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 \${isDesktopSidebarCollapsed ? 'md:-ml-80' : 'md:ml-0'}\`}>`;

if (code.includes(oldWrapper)) {
  code = code.replace(oldWrapper, newWrapper);
  console.log("Patched sidebar wrapper classes.");
} else {
  console.log("Could not find oldWrapper.");
}

fs.writeFileSync('src/App.tsx', code);
