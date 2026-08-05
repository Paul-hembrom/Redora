const fs = require('fs');
const content = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');
if (content.includes('<form')) console.log('Sidebar has form');
