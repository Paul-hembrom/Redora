const fs = require('fs');
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

const sliderTarget = `<span className="text-lg font-semibold">A</span>`;
const sliderReplacement = `<span className="text-lg font-semibold">A</span>
            <span className="text-xs font-mono ml-2 opacity-50 w-8">{focusFontSize}</span>`;

appCode = appCode.replace(sliderTarget, sliderReplacement);
fs.writeFileSync('src/App.tsx', appCode);
