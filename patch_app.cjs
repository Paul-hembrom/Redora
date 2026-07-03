const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const syncToast = `
      {/* Global Sync Indicator */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a] border border-white/10 shadow-lg shadow-black/50 rounded-full px-4 py-2 flex items-center gap-3"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
            <span className="text-sm font-medium text-white/90">Syncing library...</span>
          </motion.div>
        )}
      </AnimatePresence>
`;

code = code.replace(
  '<div className="flex flex-col h-[100dvh] bg-[#050505] text-white font-sans overflow-hidden">',
  '<div className="flex flex-col h-[100dvh] bg-[#050505] text-white font-sans overflow-hidden">' + syncToast
);

fs.writeFileSync('src/App.tsx', code);
