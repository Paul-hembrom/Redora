import fs from 'fs';
let code = fs.readFileSync('src/components/DocumentReader.tsx', 'utf8');

const search = `          <div className="border-b border-white/10 pb-8 flex justify-between items-start">
            <h1 className="text-3xl font-display font-bold text-white mb-4">{document.name}</h1>
            <button
              onClick={handleExportAllExercises}
              className="flex items-center gap-2 text-xs font-medium bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 px-4 py-2 rounded-lg transition-colors border border-cyan-500/20 shadow-lg"
              title="Export all exercises to text file"
            >
              <Download className="w-4 h-4" />
              <span>Export All Exercises</span>
            </button>
          </div>
          
          {flatChapters.map((chapter, index) => {`;

const replace = `          <div className="border-b border-white/10 pb-8 flex justify-between items-start">
            <h1 className="text-3xl font-display font-bold text-white mb-4">{document.name}</h1>
            {flatChapters.length > 0 && (
              <button
                onClick={handleExportAllExercises}
                className="flex items-center gap-2 text-xs font-medium bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 px-4 py-2 rounded-lg transition-colors border border-cyan-500/20 shadow-lg"
                title="Export all exercises to text file"
              >
                <Download className="w-4 h-4" />
                <span>Export All Exercises</span>
              </button>
            )}
          </div>
          
          {flatChapters.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center text-white/50">
              <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 text-cyan-400/50">
                <BookOpen className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-semibold text-white/80 mb-2">No Content Yet</h2>
              <p>Curriculum content is not yet available for this grade and subject.</p>
            </div>
          )}

          {flatChapters.map((chapter, index) => {`;

code = code.replace(search, replace);
fs.writeFileSync('src/components/DocumentReader.tsx', code);
