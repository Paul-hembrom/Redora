import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

// Replace the HTML image with Markdown image
content = content.replace(
  /fullContent \+\= '\\\\n\\\\n### Related Images\\\\n<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">';[\s\S]*?fullContent \+\= '<\/div>\\\\n';/g,
  `fullContent += '\\n\\n### Related Images\\n\\n';
          row.images.forEach((img: any) => {
             fullContent += \`![\${img.alt}](\${img.url})\\n\\n\`;
          });`
);

fs.writeFileSync('server.ts', content);
console.log("Fixed markdown format");
