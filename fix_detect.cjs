const fs = require('fs');
let content = fs.readFileSync('server/videoPipeline.ts', 'utf-8');

const oldKeywords = `  const manimKeywords = [
    'equation','formula','graph','vector','integral','derivative','matrix','trig',
    'algebra','calculus','physics','mechanics','electromagnetic','wave function',
    'ohm','newton','f = ma','quantum','manim','theorem','proof','geometry','plot','axis',
  ];`;

const newKeywords = `  const manimKeywords = [
    'equation','formula','graph','vector','integral','derivative','matrix','trig',
    'algebra','calculus','physics','mechanics','electromagnetic','wave function',
    'ohm','newton','f = ma','quantum','manim','theorem','proof','geometry',
    'plot','axis','function','coordinate','angle','triangle','set notation',
  ];`;

content = content.replace(oldKeywords, newKeywords);
fs.writeFileSync('server/videoPipeline.ts', content);
console.log("Fixed detectRendererFromPrompt");
