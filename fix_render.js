import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
`                isStudent={isStudent}
              />
            ) : (
            <div 
               {...getEmptyRootProps()}
              className={cn(`,
`                isStudent={isStudent}
              />
            ) : isCurriculumLoading ? (
               <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                 <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                 <p className="text-white/60">Loading curriculum...</p>
               </div>
            ) : isCurriculum && selectedDoc?.chapters?.length === 0 ? (
               <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-white/50">
                 <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 text-cyan-400/50">
                   <BookOpen className="w-10 h-10 md:w-12 md:h-12" />
                 </div>
                 <h2 className="text-2xl font-display font-semibold text-white/80 mb-4">No Content Yet</h2>
                 <p className="text-white/60 max-w-md text-center leading-relaxed">Curriculum content is not yet available for this grade and subject.</p>
               </div>
            ) : (
            <div 
               {...getEmptyRootProps()}
              className={cn(`
);

fs.writeFileSync('src/App.tsx', code);
