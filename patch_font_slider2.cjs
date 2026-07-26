const fs = require('fs');

let appCode = fs.readFileSync('src/App.tsx', 'utf8');

const sliderTarget = `<input 
              type="range" 
              min="0" 
              max="2" 
              step="1"
              value={focusFontSize === 'base' ? 0 : focusFontSize === 'lg' ? 1 : 2}
              onChange={(e) => {
                const val = e.target.value;
                setFocusFontSize(val === '0' ? 'base' : val === '1' ? 'lg' : 'xl');
              }}
              className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              title="Adjust Font Size"
            />`;

const sliderReplacement = `<input 
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

appCode = appCode.replace(sliderTarget, sliderReplacement);

fs.writeFileSync('src/App.tsx', appCode);

