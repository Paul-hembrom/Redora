import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

const oldHtml = `       if (row.images && Array.isArray(row.images) && row.images.length > 0) {
          fullContent += '\\n\\n### Related Images\\n<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">';
          row.images.forEach((img: any) => {
             fullContent += \`<img src="\${img.url}" alt="\${img.alt}" class="w-full rounded-lg shadow-sm" />\`;
          });
          fullContent += '</div>\\n';
       }`;

const newMd = `       if (row.images && Array.isArray(row.images) && row.images.length > 0) {
          fullContent += '\\n\\n### Related Images\\n\\n';
          row.images.forEach((img: any) => {
             fullContent += \`![\${img.alt}](\${img.url})\\n\\n\`;
          });
       }`;

if (content.includes(oldHtml)) {
  content = content.replace(oldHtml, newMd);
  fs.writeFileSync('server.ts', content);
  console.log("Fixed markdown format");
} else {
  console.log("HTML block not found!");
}
