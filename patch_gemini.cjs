const fs = require('fs');
const path = 'src/lib/gemini.ts';
const content = fs.readFileSync(path, 'utf8');

const newCode = `

/**
 * Generates an adaptive explanation for practice questions across any subject.
 */
export async function generatePracticeQuestionExplanation(
  questionText: string,
  answerText: string,
  grade: string,
  subject: string,
  topic: string
): Promise<string> {
  const systemInstruction = \`
You are a patient, encouraging tutor helping a student review a practice question.
The student is in \${grade || 'school'}, studying \${subject || 'a general subject'}. The topic is "\${topic || 'Unknown'}".
The question and correct answer are provided below.
Explain the reasoning behind the correct answer in simple, clear steps suitable for this grade level.
Keep the explanation under 100 words.
If the question is multiple-choice, explain why the correct option is right and briefly mention why the other options are wrong.
If the question is true/false, explain the concept that makes the statement true or false.
If the question is a short-answer or long-answer, provide a model answer that a student could use as a reference.
Adapt your explanation style to the subject (e.g., use formula steps for math, use scientific reasoning for science, use historical context for history).
\`.trim();

  const userPrompt = \`
Question:
\${questionText}

Correct Answer:
\${answerText}
\`.trim();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: userPrompt }],
        systemInstruction
      })
    });
    
    if (!response.ok) {
      throw new Error(\`Failed to generate explanation: \${response.statusText}\`);
    }
    
    const data = await response.json();
    return data.response;
  } catch (err) {
    console.error("AI Explanation Error:", err);
    throw err;
  }
}
`;

const lines = content.split('\n');
const insertIndex = lines.findIndex(l => l.includes('export async function generateExerciseAnswer'));

lines.splice(insertIndex, 0, newCode);

fs.writeFileSync(path, lines.join('\n'));
