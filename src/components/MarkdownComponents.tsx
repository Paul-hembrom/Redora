import React from 'react';

export const markdownComponents = {
  h1: ({node, ...props}: any) => <h1 style={{fontSize: '1.5rem', fontWeight: 'bold', marginTop: '1rem', marginBottom: '0.5rem'}} {...props} />,
  h2: ({node, ...props}: any) => <h2 style={{fontSize: '1.25rem', fontWeight: 'bold', marginTop: '0.8rem', marginBottom: '0.5rem'}} {...props} />,
  ul: ({node, ...props}: any) => <ul style={{paddingLeft: '1rem', marginBottom: '0.8rem', listStyleType: 'none'}} {...props} />,
  ol: ({node, ...props}: any) => <ol style={{paddingLeft: '1rem', marginBottom: '0.8rem', listStyleType: 'none', counterReset: 'item'}} {...props} />,
  li: ({node, children, ...props}: any) => {
    // Check if it's ordered or unordered
    const isOrdered = node?.parent?.tagName === 'ol';
    const index = node?.parent?.children?.filter((c: any) => c.tagName === 'li').indexOf(node) ?? 0;
    
    if (isOrdered) {
      return (
        <li style={{marginBottom: '0.4rem', display: 'flex', alignItems: 'baseline'}} {...props}>
          <span style={{ flexShrink: 0, marginRight: '0.5rem' }}>{index + 1}.</span>
          <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        </li>
      );
    }

    return (
      <li style={{marginBottom: '0.4rem', display: 'flex', alignItems: 'baseline'}} {...props}>
        <span style={{ flexShrink: 0, marginRight: '0.5rem' }}>•</span>
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
    <thead style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }} {...props}>
      {children}
    </thead>
  ),
  tbody: ({node, children, ...props}: any) => (
    <tbody {...props}>
      {children}
    </tbody>
  ),
  tr: ({node, children, ...props}: any) => (
    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }} {...props}>
      {children}
    </tr>
  ),
  th: ({node, children, ...props}: any) => (
    <th style={{ border: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)' }} {...props}>
      {children}
    </th>
  ),
  td: ({node, children, ...props}: any) => (
    <td style={{ border: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.75rem 1rem', color: 'rgba(255, 255, 255, 0.7)' }} {...props}>
      {children}
    </td>
  )
};
