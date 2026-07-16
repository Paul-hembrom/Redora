import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const sidebarWrapperStr = \`<div className={\\\`absolute md:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out flex \${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}\\\`}>\`;
const newSidebarWrapperStr = \`<div className={\\\`absolute md:static inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out flex \${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} \${isDesktopSidebarCollapsed ? 'md:-translate-x-full md:w-0 overflow-hidden md:opacity-0 md:pointer-events-none' : 'md:translate-x-0 md:w-80 md:opacity-100'}\\\`}>\`;

if (code.includes(sidebarWrapperStr)) {
  code = code.replace(sidebarWrapperStr, newSidebarWrapperStr);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched App.tsx sidebar wrapper");
} else {
  console.log("Could not find sidebar wrapper string");
}
