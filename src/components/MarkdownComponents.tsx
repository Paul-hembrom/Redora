import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReadAloudButton } from './ReadAloudButton';
import { generatePracticeQuestionExplanation } from '../lib/gemini';
export const QuestionContext = React.createContext<{
  blockText?: string;
  grade?: string;
  subject?: string;
  topic?: string;
}>({});


const TableWrapper = ({ node, children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  
  const extractText = (n: any): string => {
    if (n.type === 'text') return n.value || '';
    if (n.children) return n.children.map(extractText).join('');
    return '';
  };
  
  const handleCopyCsv = () => {
    try {
      let csv = '';
      const rows = node.children.filter((c: any) => c.tagName === 'thead' || c.tagName === 'tbody')
        .flatMap((group: any) => group.children.filter((c: any) => c.tagName === 'tr'));
        
      rows.forEach((row: any) => {
        const cells = row.children.filter((c: any) => c.tagName === 'th' || c.tagName === 'td');
        const rowData = cells.map((cell: any) => {
          let text = extractText(cell).trim();
          // Escape quotes and wrap in quotes if contains comma
          if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            text = `"${text.replace(/"/g, '""')}"`;
          }
          return text;
        });
        csv += rowData.join(',') + '\n';
      });
      
      navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to parse table to CSV', e);
    }
  };

  return (
    <div className="relative group/table mb-6">
      <div className="absolute top-2 right-2 opacity-0 group-hover/table:opacity-100 transition-opacity z-10">
        <button
          onClick={handleCopyCsv}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur text-white/70 hover:text-white rounded-md border border-white/10 text-xs font-medium transition-all shadow-lg"
          title="Copy as CSV"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'CSV'}</span>
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full border-collapse text-sm" {...props}>
          {children}
        </table>
      </div>
    </div>
  );
};

const AnswerWrapper = ({ node, children, ...props }: any) => {
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
};

export const markdownComponents = {
  h1: ({node, ...props}: any) => <h1 style={{fontSize: '1.5rem', fontWeight: 'bold', marginTop: '1rem', marginBottom: '0.5rem'}} {...props} />,
  h2: ({node, ...props}: any) => <h2 style={{fontSize: '1.25rem', fontWeight: 'bold', marginTop: '0.8rem', marginBottom: '0.5rem'}} {...props} />,
  h4: ({node, ...props}: any) => <h4 className="font-bold text-lg md:text-xl pb-2 border-b border-white/10 mb-4 mt-6 text-white" {...props} />,
  ul: ({node, ...props}: any) => <ul style={{paddingLeft: '0.5rem', marginBottom: '0.8rem', listStyleType: 'none', listStylePosition: 'inside', whiteSpace: 'pre-wrap'}} {...props} />,
  ol: ({node, ...props}: any) => <ol style={{paddingLeft: '0.5rem', marginBottom: '0.8rem', listStyleType: 'none', listStylePosition: 'inside', whiteSpace: 'pre-wrap', counterReset: 'item'}} {...props} />,
  li: ({node, children, ...props}: any) => {
    const isOrdered = node?.parent?.tagName === 'ol';
    const index = node?.parent?.children?.filter((c: any) => c.tagName === 'li').indexOf(node) ?? 0;
    
    return (
      <li style={{marginBottom: '0.4rem', display: 'flex', alignItems: 'baseline'}} {...props}>
        <span style={{ flexShrink: 0, marginRight: '0.5rem' }}>{isOrdered ? `${index + 1}.` : '•'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </li>
    );
  },
  p: ({node, children, ...props}: any) => {
    return <p style={{lineHeight: '1.7', marginTop: 0, marginBottom: '0.8rem', whiteSpace: 'pre-wrap'}} {...props}>{children}</p>;
  },
  em: AnswerWrapper,
  table: TableWrapper,
  thead: ({node, children, ...props}: any) => (
    <thead style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }} {...props}>
      {children}
    </thead>
  ),
  tbody: ({node, children, ...props}: any) => (
    <tbody {...props}>
      {children}
    </tbody>
  ),
  tr: ({node, children, ...props}: any) => {
    const index = node?.parent?.children?.filter((c: any) => c.tagName === 'tr').indexOf(node) ?? 0;
    const isEven = index % 2 === 0;
    return (
      <tr 
        className="border-b border-white/5 hover:bg-white/10 transition-colors"
        style={{ backgroundColor: isEven ? 'rgba(255, 255, 255, 0.02)' : 'transparent' }} 
        {...props}
      >
        {children}
      </tr>
    );
  },
  th: ({node, children, ...props}: any) => (
    <th style={{ borderRight: '1px solid rgba(255, 255, 255, 0.05)', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)' }} {...props}>
      {children}
    </th>
  ),
  td: ({node, children, ...props}: any) => (
    <td style={{ borderRight: '1px solid rgba(255, 255, 255, 0.05)', padding: '0.75rem 1rem', color: 'rgba(255, 255, 255, 0.7)' }} {...props}>
      {children}
    </td>
  ),
  img: ({node, src, alt, ...props}: any) => (
    <img src={src} alt={alt || 'Image'} className="max-w-full h-auto rounded-xl shadow-lg my-6 border border-white/10" loading="lazy" {...props} />
  ),
  a: ({node, children, href, ...props}: any) => {
    if (href && (href.includes('youtube.com/watch?v=') || href.includes('youtu.be/'))) {
      const videoId = href.includes('v=') ? href.split('v=')[1].split('&')[0] : href.split('youtu.be/')[1].split('?')[0];
      return (
        <div className="my-6 aspect-video rounded-xl overflow-hidden border border-white/10 shadow-2xl relative bg-black/50 w-full max-w-2xl">
          <iframe 
            src={`https://www.youtube.com/embed/${videoId}`} 
            title="YouTube video player" 
            className="w-full h-full absolute inset-0 border-0"
            allowFullScreen
          />
        </div>
      );
    }
    return <a href={href} className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
  }
};
