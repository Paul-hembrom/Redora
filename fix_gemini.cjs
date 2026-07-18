const fs = require('fs');
const path = 'src/lib/gemini.ts';
let content = fs.readFileSync(path, 'utf8');

const oldCodeStart = 'export async function generatePracticeQuestionExplanation(';
const oldCodeEnd = '  }\n}\n';

const startIndex = content.indexOf(oldCodeStart);
const endIndex = content.indexOf(oldCodeEnd, startIndex) + oldCodeEnd.length;

const newCode = `export async function generatePracticeQuestionExplanation(
  questionText: string,
  answerText: string,
  grade?: string,
  subject?: string,
  topic?: string
): Promise<string> {
  const isContextIncomplete = !grade || !subject || !topic;
  let systemInstruction = "";

  if (isContextIncomplete) {
    systemInstruction = \`
You are a patient, encouraging tutor helping a student review a practice question.
The question and correct answer are provided below.
Explain the reasoning behind the correct answer in simple, clear steps.
Keep the explanation under 100 words.
If the question is multiple-choice, explain why the correct option is right and briefly mention why the other options are wrong.
If the question is true/false, explain the concept that makes the statement true or false.
If the question is a short-answer or long-answer, provide a model answer that a student could use as a reference.
\`.trim();
  } else {
    systemInstruction = \`
You are a patient, encouraging tutor helping a student review a practice question.
The student is in \${grade}, studying \${subject}. The topic is "\${topic}".
The question and correct answer are provided below.
Explain the reasoning behind the correct answer in simple, clear steps suitable for this grade level.
Keep the explanation under 100 words.
If the question is multiple-choice, explain why the correct option is right and briefly mention why the other options are wrong.
If the question is true/false, explain the concept that makes the statement true or false.
If the question is a short-answer or long-answer, provide a model answer that a student could use as a reference.
Adapt your explanation style to the subject (e.g., use formula steps for math, use scientific reasoning for science, use historical context for history).
\`.trim();
  }

  const userPrompt = \`
Question:
\${questionText}

Correct Answer:
\${answerText}
\`.trim();

  try {
    return await callLLM(userPrompt, systemInstruction, 'text', 2048);
  } catch (err) {
    console.error("AI Explanation Error:", err);
    throw err;
  }
}
`;

content = content.substring(0, startIndex) + newCode + content.substring(endIndex);
fs.writeFileSync(path, content);
