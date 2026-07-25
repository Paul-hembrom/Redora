const fs = require('fs');
let content = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// Replace the `<select>` for playback rate with an `<input type="range">`
// Old select block:
/*
          <div className="flex items-center shrink-0 bg-black/40 rounded-lg border border-white/5 p-1 mr-2 gap-1">
             <Volume2 className="w-3.5 h-3.5 text-white/40 ml-1" />
             <select 
               value={playbackRate} 
               onChange={e => setPlaybackRate(Number(e.target.value))}
               className="bg-transparent text-xs text-white/80 font-medium focus:outline-none appearance-none px-2"
             >
               <option value={0.8}>0.8x</option>
               <option value={1}>1.0x</option>
               <option value={1.25}>1.25x</option>
             </select>
          </div>
*/

const oldSelect = /<div className="flex items-center shrink-0 bg-black\/40 rounded-lg border border-white\/5 p-1 mr-2 gap-1">[\s\S]*?<\/select>\n\s*<\/div>/;

const newSlider = `<div className="flex items-center shrink-0 bg-black/40 rounded-lg border border-white/5 px-2 py-1.5 mr-2 gap-2">
             <Volume2 className="w-3.5 h-3.5 text-white/40" />
             <input
               type="range"
               min="0.5"
               max="2.0"
               step="0.1"
               value={playbackRate}
               onChange={e => setPlaybackRate(Number(e.target.value))}
               className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
             />
             <span className="text-[10px] text-white/60 font-medium w-6 text-right">{playbackRate.toFixed(1)}x</span>
          </div>`;

content = content.replace(oldSelect, newSlider);

fs.writeFileSync('src/components/ChatArea.tsx', content);
console.log("Replaced select with slider in ChatArea");
