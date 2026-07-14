import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. anonymous fetch
code = code.replace(
`    if (source === 'curriculum' && grade && subject) {
      if (user) return; // Handled in the main fetch below
      
      fetch(\`/api/curriculum?grade=\${encodeURIComponent(grade)}&subject=\${encodeURIComponent(subject)}\`)`,
`    if (source === 'curriculum' && grade && subject) {
      if (user) return; // Handled in the main fetch below
      
      setIsCurriculumLoading(true);
      fetch(\`/api/curriculum?grade=\${encodeURIComponent(grade)}&subject=\${encodeURIComponent(subject)}\`)`
);

code = code.replace(
`           setCurriculumError("Curriculum content not yet available for this grade and subject.");
        });
      return;`,
`           setCurriculumError("Curriculum content not yet available for this grade and subject.");
        })
        .finally(() => setIsCurriculumLoading(false));
      return;`
);

// 2. Logged in fetch
code = code.replace(
`            if (source === 'curriculum' && grade && subject) {
              try {`,
`            if (source === 'curriculum' && grade && subject) {
              setIsCurriculumLoading(true);
              try {`
);

code = code.replace(
`              } catch (err) {
                 console.error("Failed to fetch curriculum:", err);
                 setUploadError("Failed to fetch curriculum content.");
              }
            }`,
`              } catch (err) {
                 console.error("Failed to fetch curriculum:", err);
                 setUploadError("Failed to fetch curriculum content.");
              } finally {
                 setIsCurriculumLoading(false);
              }
            }`
);

fs.writeFileSync('src/App.tsx', code);
