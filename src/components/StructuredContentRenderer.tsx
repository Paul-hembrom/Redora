import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownComponents, QuestionContext } from './MarkdownComponents';
import { smartNormalizeText } from '../lib/utils';
import { Copy, Check, Table as TableIcon, Code as CodeIcon, Image as ImageIcon, Calculator } from 'lucide-react';
import { cn } from '../lib/utils';

export interface StructuredBlock {
  type?: string;
  label?: string; // Docling labels: 'title', 'section_header', 'paragraph', 'table', 'code', 'list_item', 'formula', 'caption', 'picture'
  text?: string;
  content?: string;
  level?: number;
  headers?: string[];
  rows?: string[][];
  grid?: string[][];
  items?: string[];
  caption?: string;
  url?: string;
  src?: string;
  code?: string;
  language?: string;
  ordered?: boolean;
  data?: any;
}

export function HeaderBlock({ level = 2, text }: { level?: number; text: string }) {
  const normalized = smartNormalizeText(text);
  if (level === 1) {
    return (
      <h1 className="text-2xl md:text-3xl font-display font-bold text-white mt-8 mb-4 pb-2 border-b border-cyan-500/30 flex items-center gap-2">
        <span className="w-1.5 h-6 bg-cyan-400 rounded-full inline-block shrink-0" />
        <span>{normalized}</span>
      </h1>
    );
  }
  if (level === 2) {
    return (
      <h2 className="text-xl md:text-2xl font-display font-semibold text-white/95 mt-6 mb-3 pb-1 border-b border-white/10 flex items-center gap-2">
        <span className="w-1 h-5 bg-cyan-400/70 rounded-full inline-block shrink-0" />
        <span>{normalized}</span>
      </h2>
    );
  }
  if (level === 3) {
    return (
      <h3 className="text-lg md:text-xl font-semibold text-cyan-300 mt-5 mb-2">
        {normalized}
      </h3>
    );
  }
  return (
    <h4 className="text-base md:text-lg font-medium text-white/90 mt-4 mb-2">
      {normalized}
    </h4>
  );
}

export function ParagraphBlock({ text, isFocusMode, focusFontSize }: { text: string; isFocusMode?: boolean; focusFontSize?: string }) {
  const normalized = smartNormalizeText(text);
  return (
    <div className={cn("text-white/80 leading-relaxed my-3 font-serif", isFocusMode ? `prose-${focusFontSize} focus-mode-text` : "text-base")}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

export function TableBlock({ headers, rows, caption }: { headers?: string[]; rows?: string[][]; caption?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopyCsv = () => {
    let csv = '';
    if (headers && headers.length > 0) {
      csv += headers.map(h => `"${(h || '').replace(/"/g, '""')}"`).join(',') + '\n';
    }
    if (rows && rows.length > 0) {
      rows.forEach(row => {
        csv += row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',') + '\n';
      });
    }
    navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 group/table relative">
      {caption && (
        <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400/80 mb-2 flex items-center gap-1.5">
          <TableIcon className="w-3.5 h-3.5" />
          <span>{caption}</span>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 backdrop-blur shadow-xl relative">
        <button
          onClick={handleCopyCsv}
          className="absolute top-2 right-2 opacity-0 group-hover/table:opacity-100 transition-opacity z-10 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/70 hover:bg-black/90 text-white/80 rounded-md border border-white/10 text-xs font-medium"
          title="Copy table as CSV"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied CSV' : 'CSV'}</span>
        </button>
        <table className="w-full border-collapse text-sm">
          {headers && headers.length > 0 && (
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left font-semibold text-white/90 border-r border-white/5 last:border-r-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          {rows && rows.length > 0 && (
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-white/5 odd:bg-white/[0.02] hover:bg-white/10 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-3 text-white/70 border-r border-white/5 last:border-r-0">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

export function FormulaBlock({ text }: { text: string }) {
  return (
    <div className="my-4 p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-cyan-200 font-mono text-center overflow-x-auto shadow-inner flex items-center justify-center gap-3">
      <Calculator className="w-5 h-5 text-cyan-400 shrink-0" />
      <span className="text-base md:text-lg tracking-wide">{text}</span>
    </div>
  );
}

export function PictureBlock({ src, caption }: { src: string; caption?: string }) {
  return (
    <figure className="my-6 flex flex-col items-center">
      <img src={src} alt={caption || "Document Figure"} className="max-w-full h-auto rounded-xl border border-white/10 shadow-2xl" loading="lazy" />
      {caption && (
        <figcaption className="mt-2 text-xs text-white/50 italic text-center flex items-center gap-1">
          <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
          <span>{caption}</span>
        </figcaption>
      )}
    </figure>
  );
}

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl border border-white/10 bg-[#0d0d0d] overflow-hidden group/code relative">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5 text-xs text-white/50">
        <span className="font-mono flex items-center gap-1.5">
          <CodeIcon className="w-3.5 h-3.5 text-cyan-400" />
          <span>{language || 'code'}</span>
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-white/60 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 text-xs md:text-sm font-mono text-cyan-100 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function ListBlock({ items, ordered }: { items: string[]; ordered?: boolean }) {
  return (
    <ul className={cn("my-3 space-y-1.5 pl-4 text-white/80", ordered ? "list-decimal" : "list-disc")}>
      {items.map((item, idx) => (
        <li key={idx} className="leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {smartNormalizeText(item)}
          </ReactMarkdown>
        </li>
      ))}
    </ul>
  );
}

interface StructuredContentRendererProps {
  content: string | any;
  topicTitle?: string;
  isFocusMode?: boolean;
  focusFontSize?: string;
  idPrefix?: string;
}

export function StructuredContentRenderer({
  content,
  topicTitle,
  isFocusMode,
  focusFontSize,
  idPrefix = 'tts-block-'
}: StructuredContentRendererProps) {
  // Try parsing content as JSON if it's a string
  let structuredData: any = null;
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        structuredData = JSON.parse(trimmed);
      } catch (e) {
        structuredData = null;
      }
    }
  } else if (content && typeof content === 'object') {
    structuredData = content;
  }

  // Extract blocks array if present in structured object (e.g. Docling output { texts: [], tables: [], blocks: [] })
  let blocks: StructuredBlock[] | null = null;
  if (Array.isArray(structuredData)) {
    blocks = structuredData;
  } else if (structuredData && typeof structuredData === 'object') {
    if (Array.isArray(structuredData.blocks)) blocks = structuredData.blocks;
    else if (Array.isArray(structuredData.nodes)) blocks = structuredData.nodes;
    else if (Array.isArray(structuredData.items)) blocks = structuredData.items;
    else if (Array.isArray(structuredData.elements)) blocks = structuredData.elements;
    else if (Array.isArray(structuredData.children)) blocks = structuredData.children;
  }

  // Render structured JSON blocks directly if available
  if (blocks && blocks.length > 0) {
    return (
      <div className="space-y-4">
        {blocks.map((block, idx) => {
          const type = (block.type || block.label || 'paragraph').toLowerCase();
          const blockText = block.text || block.content || '';

          if (type === 'header' || type === 'heading' || type === 'title' || type === 'section_header') {
            const level = block.level || (type === 'title' ? 1 : 2);
            return <HeaderBlock key={idx} level={level} text={blockText} />;
          }

          if (type === 'table') {
            const headers = block.headers || block.data?.headers || (block.grid ? block.grid[0] : block.data?.grid ? block.data.grid[0] : undefined);
            const rows = block.rows || block.data?.rows || (block.grid ? block.grid.slice(1) : block.data?.grid ? block.data.grid.slice(1) : undefined);
            return (
              <TableBlock
                key={idx}
                headers={headers}
                rows={rows}
                caption={block.caption || block.data?.caption}
              />
            );
          }

          if (type === 'formula' || type === 'equation') {
            return <FormulaBlock key={idx} text={blockText} />;
          }

          if (type === 'picture' || type === 'image') {
            return <PictureBlock key={idx} src={block.url || block.src || ''} caption={block.caption} />;
          }

          if (type === 'code') {
            return <CodeBlock key={idx} code={block.code || blockText} language={block.language} />;
          }

          if (type === 'list' || type === 'list_item') {
            const items = block.items || [blockText];
            return <ListBlock key={idx} items={items} ordered={block.ordered} />;
          }

          return (
            <QuestionContext.Provider
              key={idx}
              value={{
                blockText,
                topic: topicTitle
              }}
            >
              <div id={`${idPrefix}${idx}`}>
                <ParagraphBlock
                  text={blockText}
                  isFocusMode={isFocusMode}
                  focusFontSize={focusFontSize}
                />
              </div>
            </QuestionContext.Provider>
          );
        })}
      </div>
    );
  }

  // Fallback to Markdown text processing
  const normalizedText = typeof content === 'string' ? smartNormalizeText(content) : '';
  let textBlocks: string[] = normalizedText.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
  if (!textBlocks.length) textBlocks = [normalizedText];

  return (
    <div className="space-y-4">
      {textBlocks.map((s, idx) => (
        <QuestionContext.Provider
          key={idx}
          value={{
            blockText: s,
            topic: topicTitle
          }}
        >
          <div id={`${idPrefix}${idx}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {s}
            </ReactMarkdown>
          </div>
        </QuestionContext.Provider>
      ))}
    </div>
  );
}
