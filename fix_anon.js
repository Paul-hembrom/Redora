import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
`  if (curriculumError && !user) {`,
`  if (isCurriculumLoading && !user) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)] mb-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-white/40 font-display tracking-widest uppercase text-sm font-medium animate-pulse">Loading Curriculum</p>
      </div>
    );
  }

  if (curriculumError && !user) {`
);

fs.writeFileSync('src/App.tsx', code);
