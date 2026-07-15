import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const search = `        // 4. Generate Questions
        let questions: any[] = [];
        if (generateQuestions) {
          const qPrompt = \`Based on this content: \${generatedContent}

Generate 3 multiple-choice questions for \${grade} \${subject}. Return JSON exactly matching this array schema: [{"question":"...","options":["A","B","C","D"],"answer":"A"}]\`;
          try {
            const rawQ = await callLLM(qPrompt, undefined, 'json_object');
            const parsedQ = JSON.parse(rawQ.replace(/^\\s*\`\`\`json/, '').replace(/\`\`\`\\s*$/, '').trim());
            questions = Array.isArray(parsedQ) ? parsedQ : (parsedQ.questions || []);
          } catch(e) {}
        }`;

const replace = `        // 4. Generate Questions
        let questions: any[] = [];
        if (generateQuestions) {
          const qPrompt = \`Based on this content: \${generatedContent}

Generate 3 multiple-choice questions for \${grade} \${subject}. Return JSON exactly matching this array schema: [{"question":"...","options":["A","B","C","D"],"answer":"A"}]\`;
          try {
            const rawQ = await callLLM(qPrompt, undefined, 'json_object');
            const parsedQ = JSON.parse(rawQ.replace(/^\\s*\`\`\`json/, '').replace(/\`\`\`\\s*$/, '').trim());
            questions = Array.isArray(parsedQ) ? parsedQ : (parsedQ.questions || []);
          } catch(e) {}
          
          if (!Array.isArray(questions) || questions.length === 0) {
            const firstSentence = generatedContent.split(/[.!?] /)[0] + '.';
            questions = [{
              question: \`True or False: \${firstSentence}\`,
              options: ['True', 'False'],
              answer: 'True'
            }];
          }
        }`;

if (code.includes(search)) {
  code = code.replace(search, replace);
  fs.writeFileSync('server.ts', code);
  console.log('Fixed generation fallback');
} else {
  console.log('Could not find generation block');
}
