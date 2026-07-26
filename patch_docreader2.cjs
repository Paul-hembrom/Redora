const fs = require('fs');
let code = fs.readFileSync('src/components/DocumentReader.tsx', 'utf8');

const target = `{/* Table of Contents - Sidebar */}
      <div className="w-full md:w-64 border-r border-white/5 bg-[#0a0a0a]/50 p-4 shrink-0 overflow-y-auto">`;

const replacement = `{/* Table of Contents - Sidebar */}
      {!isFocusMode && (
      <div className="w-full md:w-64 border-r border-white/5 bg-[#0a0a0a]/50 p-4 shrink-0 overflow-y-auto">`;

code = code.replace(target, replacement);

const targetEnd = `        </ul>
      </div>`;

const replacementEnd = `        </ul>
      </div>
      )}`;

code = code.replace(targetEnd, replacementEnd);
fs.writeFileSync('src/components/DocumentReader.tsx', code);
