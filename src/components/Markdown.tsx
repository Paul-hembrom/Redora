import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { markdownComponents } from './MarkdownComponents';

interface MarkdownProps {
  children: string;
  components?: any;
  className?: string;
}

export function Markdown({ children, components, className }: MarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#f87171' }]]}
        components={components || markdownComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default Markdown;
