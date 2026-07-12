import fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf8');

// Unauthenticated block:
const unauthPattern = /(const source = urlParams\.get\('source'\);\n\s*const subtopic = urlParams\.get\('subtopic'\);\n\s*const subtopic = urlParams\.get\('subtopic'\);\n\s*const grade = urlParams\.get\('grade'\);\n\s*const subject = urlParams\.get\('subject'\);)/g;

code = code.replace(unauthPattern, `const source = urlParams.get('source');\n    const subtopic = urlParams.get('subtopic');\n    const grade = urlParams.get('grade');\n    const subject = urlParams.get('subject');`);

code = code.replace(/alert\("This curriculum content is not yet available\."\);/, 'alert("Curriculum content not yet available for this grade and subject.");');

fs.writeFileSync('src/App.tsx', code);
