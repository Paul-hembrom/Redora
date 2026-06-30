import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

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
  )
};
