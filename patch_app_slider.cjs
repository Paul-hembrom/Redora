const fs = require('fs');

let appCode = fs.readFileSync('src/App.tsx', 'utf8');

const sliderTarget = `<input 
              type="range" 
              min="0" 
              max="4" 
              step="1"
              value={focusFontSize === 'base' ? 0 : focusFontSize === 'lg' ? 1 : focusFontSize === 'xl' ? 2 : focusFontSize === '2xl' ? 3 : 4}
              onChange={(e) => {
                const sizes = ['base', 'lg', 'xl', '2xl', '3xl'];
                setFocusFontSize(sizes[e.target.value]);
              }}
              className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              title="Adjust Font Size"
            />`;

const sliderReplacement = `<input 
              type="range" 
              min="0" 
              max="6" 
              step="1"
              value={focusFontSize === 'base' ? 0 : focusFontSize === 'lg' ? 1 : focusFontSize === 'xl' ? 2 : focusFontSize === '3xl' ? 3 : focusFontSize === '4xl' ? 4 : focusFontSize === '5xl' ? 5 : 6}
              onChange={(e) => {
                const sizes = ['base', 'lg', 'xl', '3xl', '4xl', '5xl', '6xl'];
                setFocusFontSize(sizes[e.target.value]);
              }}
              className="w-32 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              title="Adjust Font Size"
            />`;

appCode = appCode.replace(sliderTarget, sliderReplacement);
fs.writeFileSync('src/App.tsx', appCode);

