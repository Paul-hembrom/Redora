import fs from 'fs';
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

code = code.replace(/const sentences = text\.match.*?setIsPlaying\(true\);/s, "setIsLoading(false);\n      setIsPlaying(true);");
code = code.replace(/restoreDOM\(\);\s*return;/g, "return;");
code = code.replace(/restoreDOM\(\);\s*if \(\!stopIntentRef/g, "if (!stopIntentRef");
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
