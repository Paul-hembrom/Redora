import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/setUploadError\("Curriculum content not yet available for this grade and subject\."\);/g, 'setCurriculumError("Curriculum content not yet available for this grade and subject.");');
code = code.replace(/setUploadError\("Failed to fetch curriculum content\."\);/g, 'setCurriculumError("Curriculum content not yet available.");');
code = code.replace(/setUploadError\(errData\.error \|\| "Failed to fetch curriculum content\."\);/g, 'setCurriculumError("Curriculum content not yet available.");');

// Change `if (curriculumError && !user)` to `if (curriculumError)`
code = code.replace('if (curriculumError && !user) {', 'if (curriculumError) {');

fs.writeFileSync('src/App.tsx', code);
