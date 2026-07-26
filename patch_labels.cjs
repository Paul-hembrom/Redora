const fs = require('fs');

let appCode = fs.readFileSync('src/App.tsx', 'utf8');

const target = `<span className="text-xs font-mono ml-2 opacity-50 w-8">{focusFontSize}</span>`;
const replacement = `<span className="text-xs font-mono ml-2 opacity-50 w-8 text-right">
              {focusFontSize === 'base' ? 'SM' : 
               focusFontSize === 'lg' ? 'MD' : 
               focusFontSize === 'xl' ? 'LG' : 
               focusFontSize === '3xl' ? 'XL' : 
               focusFontSize === '4xl' ? '2XL' : 
               focusFontSize === '5xl' ? '3XL' : '4XL'}
            </span>`;

appCode = appCode.replace(target, replacement);

fs.writeFileSync('src/App.tsx', appCode);

