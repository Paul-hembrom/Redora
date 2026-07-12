import fs from 'fs';

let appTsx = fs.readFileSync('src/App.tsx', 'utf8');
appTsx = appTsx.replace(/import\('\.\/lib\/offline'\)\.then\(m => m\.cacheDocuments\(data\)\);/g, "cacheDocuments(data);");
appTsx = appTsx.replace(/import\('\.\/lib\/offline'\)\.then\(m => m\.getCachedDocuments\(\)\)\.then\(docs => \{/g, "getCachedDocuments().then(docs => {");
if (!appTsx.includes("import { cacheDocuments, getCachedDocuments }")) {
    appTsx = "import { cacheDocuments, getCachedDocuments } from './lib/offline';\n" + appTsx;
}
fs.writeFileSync('src/App.tsx', appTsx);

let sidebarTsx = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
sidebarTsx = sidebarTsx.replace(/const \{ cacheDocument, cacheTopicChats, cacheTopicVideos, cacheTopicImages \} = await import\('\.\.\/lib\/offline'\);/g, "");
if (!sidebarTsx.includes("import { cacheDocument, cacheTopicChats, cacheTopicVideos, cacheTopicImages }")) {
    sidebarTsx = "import { cacheDocument, cacheTopicChats, cacheTopicVideos, cacheTopicImages } from '../lib/offline';\n" + sidebarTsx;
}
fs.writeFileSync('src/components/Sidebar.tsx', sidebarTsx);

let chatAreaTsx = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');
chatAreaTsx = chatAreaTsx.replace(/const lib = await import\('\.\.\/lib\/offline'\);/g, "");
chatAreaTsx = chatAreaTsx.replace(/await lib\.cacheTopicChats\(/g, "await cacheTopicChats(");
chatAreaTsx = chatAreaTsx.replace(/await lib\.cacheTopicVideos\(/g, "await cacheTopicVideos(");
chatAreaTsx = chatAreaTsx.replace(/await lib\.cacheTopicImages\(/g, "await cacheTopicImages(");
fs.writeFileSync('src/components/ChatArea.tsx', chatAreaTsx);

console.log("Fixed offline.ts imports!");
