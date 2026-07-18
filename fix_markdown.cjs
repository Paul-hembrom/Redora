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
      
      console.log('--- DIAGNOSTIC: Ask AI Clicked ---');
      console.log('Payload:', { grade, subject, topic, qText, textContent });
      console.log('Endpoint:', 'callLLM (via generatePracticeQuestionExplanation)');

      if (!grade || !subject || !topic) {
        console.warn('WARNING: Missing context fields for Ask AI button. Using fallback logic.', { grade, subject, topic });
      }

      const exp = await generatePracticeQuestionExplanation(
        qText,
        textContent,
        grade,
        subject,
        topic
      );
      
      console.log('HTTP Status (simulated):', 200);
      console.log('Response (first 200 chars):', exp.substring(0, 200));

      setExplanation(exp);
      setRevealed(true);
    } catch (err: any) {
      console.error('--- DIAGNOSTIC ERROR: LLM Call Failed ---');
      console.error('Error Message:', err.message);
      console.error('Stack Trace:', err.stack);
      setExplanationError("Could not generate explanation right now.");
      setTimeout(() => setExplanationError(null), 3000);
    } finally {
      setIsExplaining(false);
    }
  };
  
`;

content = content.substring(0, startIndex) + newCode + content.substring(endIndex);
fs.writeFileSync(path, content);
