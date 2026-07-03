const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

const oldIcon = `<UploadCloud className={cn(
                "w-10 h-10 mx-auto mb-3 transition-all duration-300 transform group-hover:-translate-y-1 group-hover:scale-110",
                isDragActive ? "text-cyan-400" : (uploadError || localError) ? "text-red-400" : "text-white/50 group-hover:text-cyan-400"
              )} />`;

const newIcon = `{isUploading ? (
                <Loader2 className="w-10 h-10 mx-auto mb-3 text-cyan-400 animate-spin" />
              ) : (
                <UploadCloud className={cn(
                  "w-10 h-10 mx-auto mb-3 transition-all duration-300 transform group-hover:-translate-y-1 group-hover:scale-110",
                  isDragActive ? "text-cyan-400" : (uploadError || localError) ? "text-red-400" : "text-white/50 group-hover:text-cyan-400"
                )} />
              )}`;

code = code.replace(oldIcon, newIcon);
fs.writeFileSync('src/components/Sidebar.tsx', code);
