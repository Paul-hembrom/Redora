import fs from 'fs';

let content = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

content = content.replace(
  '<div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full lg:w-auto pb-1 lg:pb-0">',
  '<ScrollableActionBar className="w-full lg:w-auto pb-1 lg:pb-0 min-w-0" innerClassName="gap-2">'
);

content = content.replace(
  '<div className="flex items-center shrink-0 gap-1.5 bg-black/40 p-1 rounded-lg border border-white/5 overflow-x-auto custom-scrollbar pr-2">',
  '<div className="flex items-center shrink-0 gap-1.5 bg-black/40 p-1 rounded-lg border border-white/5 pr-2">'
);

// find the closing tag for the ScrollableActionBar
// it's right before `{activeTab === 'video' ? (`
content = content.replace(
  / *<\/div>\n      <\/div>\n\n      \{activeTab === 'video' \? \(/,
  '        </ScrollableActionBar>\n      </div>\n\n      {activeTab === \'video\' ? ('
);

fs.writeFileSync('src/components/ChatArea.tsx', content);
