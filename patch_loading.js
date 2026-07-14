import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "const [curriculumError, setCurriculumError] = useState<string | null>(null);",
  "const [curriculumError, setCurriculumError] = useState<string | null>(null);\n  const [isCurriculumLoading, setIsCurriculumLoading] = useState(false);"
);

fs.writeFileSync('src/App.tsx', code);
