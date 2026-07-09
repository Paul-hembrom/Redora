import fs from 'fs';
let content = fs.readFileSync('src/components/MarkdownComponents.tsx', 'utf-8');

if (!content.includes('img: ({')) {
  content = content.replace(
    /td: \(\{(.*?)\}\) => \(([\s\S]*?)\n    <\/td>\n  \)/,
    `td: ({$1}) => ($2\n    </td>\n  ),\n  img: ({node, ...props}: any) => (\n    <img className="w-full sm:max-w-md rounded-lg shadow-sm my-4 object-cover" {...props} />\n  )`
  );
  fs.writeFileSync('src/components/MarkdownComponents.tsx', content);
  console.log("Added img component");
}
