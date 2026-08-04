const fs = require('fs');
let code = fs.readFileSync('server/lessonOrchestrator.ts', 'utf-8');

const target = `         const match = steps.find(s => s.id === part.id);
         if (match) {
           match.narrationText = part.narrationText;`;

const replace = `         const match = steps.find(s => s.id === part.id);
         if (match) {
           match.narrationText = (part.narrationText || '').replace(/\\[[^\\]]{0,30}\\]/g, ' ').replace(/\\s+/g, ' ').trim();`;

code = code.replace(target, replace);

// While we are here, P2-3: Maya may emit step types the frontend cannot render.
const typeTarget = `           if (part.type) match.type = part.type;`;
const typeReplace = `           const ALLOWED_STEP_TYPES = new Set(['intro','image','video','question','joke','fun_fact','recap']);
           if (part.type && ALLOWED_STEP_TYPES.has(part.type)) match.type = part.type;`;

code = code.replace(typeTarget, typeReplace);
fs.writeFileSync('server/lessonOrchestrator.ts', code);
