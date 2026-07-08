import fs from 'fs';
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf-8');

content = content.replace(
  "const handleTouchStart = (e: TouchEvent) => {\n      e.preventDefault();",
  "const handleTouchStart = (e: TouchEvent) => {\n      logInfo(\"Trigger Event: touchstart detected on ReadAloudButton\");\n      e.preventDefault();"
);

content = content.replace(
  "const handleClick = (e: MouseEvent) => {\n      e.preventDefault();",
  "const handleClick = (e: MouseEvent) => {\n      logInfo(\"Trigger Event: click detected on ReadAloudButton\");\n      e.preventDefault();"
);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
