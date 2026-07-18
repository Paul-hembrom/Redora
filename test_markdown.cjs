const fs = require('fs');
const path = 'src/components/MarkdownComponents.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldCodeStart = 'const handleAskAI = async () => {';
const oldCodeEnd = '  if (textContent.trim().startsWith(\'Answer:\')) {';

const startIndex = content.indexOf(oldCodeStart);
const endIndex = content.indexOf(oldCodeEnd, startIndex);

const newCode = `const handleAskAI = async () => {
    if (explanation) return;
    setIsExplaining(true);
    setExplanationError(null);
    try {
      const qText = context.blockText ? context.blockText.split('*Answer:')[0] : '';
      const { grade, subject, topic } = context;

      const exp = await generatePracticeQuestionExplanation(
        qText,
        textContent,
        grade,
        subject,
        topic
      );
      
      setExplanation(exp);
      setRevealed(true);
    } catch (err: any) {
      console.error('AI Explanation Error:', err.message);
      setExplanationError("Could not generate explanation right now.");
      setTimeout(() => setExplanationError(null), 3000);
    } finally {
      setIsExplaining(false);
    }
  };
  
`;

content = content.substring(0, startIndex) + newCode + content.substring(endIndex);
fs.writeFileSync(path, content);
