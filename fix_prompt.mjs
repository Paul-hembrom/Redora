import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

const oldPromptRegex = /const contentPrompt = \`Write a clear, simple textbook explanation on \$\{subtopic\} for \$\{grade\} \$\{subject\}\. Keep 150-300 words, plain paragraphs, no markdown headings\.\`;/;

const newPrompt = `const contentPrompt = \`You are an expert textbook writer for the Nepal CDC curriculum.  
Write a high‑quality, classroom‑ready explanation for the subtopic below.

Grade: \${grade}
Subject: \${subject}
Chapter: \${title}
Subtopic: \${subtopic}

RULES:
1. Strictly follow the CDC syllabus for this grade and subject. Do NOT add topics outside the given subtopic.
2. Use clear, age‑appropriate language suitable for \${grade} students.
3. Structure the explanation in plain paragraphs (no markdown headings, no bullet points). Use natural flow.
4. For math, science, computer science and optional mathematics  topics that involve formulas, equations, or problem‑solving:
   - Include 2‑3 fully worked examples with step‑by‑step solutions.
   - Explain each step in simple words.
5. For non‑math topics (history, geography, etc.):
   - Include one relevant real‑life example or case study.
6. Keep the total length between 200‑400 words. If the topic requires worked examples, you may extend up to 500 words.
7. Never invent data, names, or facts. Base everything strictly on the CDC curriculum.
8. Return ONLY the final explanation text. No additional commentary.\`;`;

if (oldPromptRegex.test(content)) {
  content = content.replace(oldPromptRegex, newPrompt);
  fs.writeFileSync('server.ts', content);
  console.log("Replaced prompt.");
} else {
  console.log("Could not find the original prompt.");
}
