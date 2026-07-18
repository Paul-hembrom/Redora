const fs = require('fs');
const path = 'src/components/MarkdownComponents.tsx';
let content = fs.readFileSync(path, 'utf8');

const importsToAdd = `import { ReadAloudButton } from './ReadAloudButton';
import { generatePracticeQuestionExplanation } from '../lib/gemini';
export const QuestionContext = React.createContext<{
  blockText?: string;
  grade?: string;
  subject?: string;
  topic?: string;
}>({});
`;

content = content.replace("import { motion, AnimatePresence } from 'motion/react';", "import { motion, AnimatePresence } from 'motion/react';\n" + importsToAdd);

const answerWrapperReplace = `const AnswerWrapper = ({ node, children, ...props }: any) => {
  const [revealed, setRevealed] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const context = React.useContext(QuestionContext);
  
  const extractText = (n: any): string => {
    if (n.type === 'text') return n.value || '';
    if (n.children) return n.children.map(extractText).join('');
    return '';
  };

  const textContent = extractText(node);
  
  const handleAskAI = async () => {
    if (explanation) return;
    setIsExplaining(true);
    setExplanationError(null);
    try {
      const qText = context.blockText ? context.blockText.split('*Answer:')[0] : '';
      const exp = await generatePracticeQuestionExplanation(
        qText,
        textContent,
        context.grade || '',
        context.subject || '',
        context.topic || ''
      );
      setExplanation(exp);
      setRevealed(true);
    } catch (err) {
      setExplanationError("Could not generate explanation right now.");
      setTimeout(() => setExplanationError(null), 3000);
    } finally {
      setIsExplaining(false);
    }
  };
  
  if (textContent.trim().startsWith('Answer:')) {
    return (
      <div className="group relative bg-white/[0.02] border border-white/5 rounded-xl p-4 mt-4 transition-all hover:bg-white/[0.04] not-italic block my-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-display font-semibold text-white/50 tracking-widest uppercase m-0 p-0 !mb-0 border-none">Answer</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAskAI}
              disabled={isExplaining || !!explanation}
              className="px-3 py-1.5 bg-black/40 hover:bg-cyan-500/20 text-white/60 hover:text-cyan-400 disabled:opacity-50 text-xs font-medium rounded-lg backdrop-blur shadow-lg border border-white/10 transition-all flex items-center gap-2"
            >
              {isExplaining ? (
                <span className="w-4 h-4 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
              ) : explanation ? (
                <Check className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <span className="text-sm">✨</span>
              )}
              <span>{explanation ? 'AI Explained' : 'Ask AI'}</span>
            </button>
            <button
              onClick={() => setRevealed(!revealed)}
              className="px-3 py-1.5 bg-black/40 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium rounded-lg backdrop-blur shadow-lg border border-white/10 transition-all flex items-center gap-2"
            >
              <span className="text-sm">🔄</span>
              <span>{revealed ? 'Hide' : 'Reveal'}</span>
            </button>
          </div>
        </div>
        
        {explanationError && (
          <div className="mt-3 text-red-400 text-xs bg-red-400/10 p-2 rounded border border-red-400/20">
            {explanationError}
          </div>
        )}

        <AnimatePresence>
          {revealed && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden space-y-4"
            >
              <div className="pt-3 border-t border-white/10 text-cyan-400">
                <em {...props}>{children}</em>
              </div>
              
              {explanation && (
                <div className="pt-3 border-t border-white/5 relative group/explanation">
                  <p className="text-xs font-display font-semibold text-cyan-400/60 tracking-widest uppercase mb-2">AI Explanation</p>
                  <div className="text-white/80 text-sm leading-relaxed pr-10">
                    {explanation}
                  </div>
                  <div className="absolute bottom-0 right-0 opacity-50 group-hover/explanation:opacity-100 transition-opacity">
                    <ReadAloudButton 
                      text={explanation}
                      className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded border border-cyan-500/20"
                      iconSizeClasses="w-3.5 h-3.5"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
  
  return <em {...props}>{children}</em>;
};`;

const startIdx = content.indexOf('const AnswerWrapper = ({ node, children, ...props }: any) => {');
const endIdx = content.indexOf('export const markdownComponents = {');

content = content.substring(0, startIdx) + answerWrapperReplace + '\n\n' + content.substring(endIdx);

fs.writeFileSync(path, content);
