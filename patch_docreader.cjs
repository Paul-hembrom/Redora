const fs = require('fs');
let code = fs.readFileSync('src/components/DocumentReader.tsx', 'utf8');

const propsRegex = /interface Props \{\n\s*document: Document;/;
code = code.replace(propsRegex, `interface Props {\n  isFocusMode?: boolean;\n  document: Document;`);

const componentRegex = /export default function DocumentReader\(\{ document, initialScrollChapterId \}: Props\) \{/;
code = code.replace(componentRegex, `export default function DocumentReader({ isFocusMode, document, initialScrollChapterId }: Props) {`);

fs.writeFileSync('src/components/DocumentReader.tsx', code);
