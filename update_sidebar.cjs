const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');

content = content.replace(
  /{!isStudent && onDeleteDocument && \(/g,
  "{!isStudent && onDeleteDocument && !doc.id.startsWith('curr_') && ("
);

content = content.replace(
  /{!isStudent && onClearChats && \(/g,
  "{!isStudent && onClearChats && !doc.id.startsWith('curr_') && ("
);

content = content.replace(
  /{!isStudent && onToggleShare && \(/g,
  "{!isStudent && onToggleShare && !doc.id.startsWith('curr_') && ("
);

content = content.replace(
  /{!isStudent && \(\n\s*<button\n\s*onClick={\(e\) => { e.stopPropagation\(\); onToggleShare\(\!doc.isPublic, doc.id\); }}/g,
  "{!isStudent && !doc.id.startsWith('curr_') && (\n                              <button\n                                onClick={(e) => { e.stopPropagation(); onToggleShare(!doc.isPublic, doc.id); }}"
);

fs.writeFileSync('src/components/Sidebar.tsx', content);
console.log("Updated Sidebar.tsx");
