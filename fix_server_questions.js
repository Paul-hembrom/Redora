import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const search = `       if (questions.length > 0) {
         fullContent += '\\n\\n### Practice Questions\\n\\n';
         questions.forEach((q: any, i: number) => {
           fullContent += \`**Q\${i+1}: \${q.question}**\\n\`;
           if (q.options) {
             q.options.forEach((opt: string) => { fullContent += \`- \${opt}\\n\`; });
           }
           fullContent += \`*Answer: \${q.answer}*\\n\\n\`;
         });
       }`;

const replace = `       if (questions.length > 0) {
         fullContent += '\\n\\n### Practice Questions\\n\\n';
         questions.forEach((q: any, i: number) => {
           fullContent += \`**Q\${i+1}: \${q.question}**\\n\`;
           if (q.options) {
             q.options.forEach((opt: string) => { fullContent += \`- \${opt}\\n\`; });
           }
           fullContent += \`*Answer: \${q.answer}*\\n\\n\`;
         });
       } else {
         fullContent += '\\n\\n### Practice Questions\\n\\n';
         fullContent += \`**Q1: What is the main idea of this section?**\\n*Answer: Review the content above to formulate your own answer.*\\n\\n\`;
       }`;

if (code.includes(search)) {
  code = code.replace(search, replace);
  fs.writeFileSync('server.ts', code);
  console.log("Replaced questions successfully.");
} else {
  console.error("Could not find search string.");
}
