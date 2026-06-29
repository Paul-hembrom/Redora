import React from 'react';

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
  table: ({node, children, ...props}: any) => (
    <div style={{ overflowX: 'auto', marginBottom: '1.5rem', borderRadius: '0.5rem', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }} {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({node, children, ...props}: any) => (
    <thead style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', borderBottom: '1px solid rgba(255, 255, 255, 0.2)' }} {...props}>
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
      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: isEven ? 'rgba(255, 255, 255, 0.02)' : 'transparent' }} {...props}>
        {children}
      </tr>
    );
  },
  th: ({node, children, ...props}: any) => (
    <th style={{ borderRight: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)' }} {...props}>
      {children}
    </th>
  ),
  td: ({node, children, ...props}: any) => (
    <td style={{ borderRight: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.75rem 1rem', color: 'rgba(255, 255, 255, 0.7)' }} {...props}>
      {children}
    </td>
  )
};
