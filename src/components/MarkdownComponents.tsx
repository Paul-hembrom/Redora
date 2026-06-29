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
          <span style={{ flexShrink: 0 }}>{index + 1}.&nbsp;</span>
          <div style={{ flex: 1 }}>{children}</div>
        </li>
      );
    }

    return (
      <li style={{marginBottom: '0.4rem', display: 'flex', alignItems: 'baseline'}} {...props}>
        <span style={{ flexShrink: 0 }}>•&nbsp;</span>
        <div style={{ flex: 1 }}>{children}</div>
      </li>
    );
  },
  p: ({node, children, ...props}: any) => {
    let isBullet = false;
    let bulletChar = '';
    let restContent: React.ReactNode[] = [];
    
    const childrenArray = React.Children.toArray(children);
    if (childrenArray.length > 0) {
      const firstChild = childrenArray[0];
      if (typeof firstChild === 'string') {
        const match = firstChild.match(/^([•◦▪\-])\s+(.*)/s);
        if (match) {
          isBullet = true;
          bulletChar = match[1];
          restContent = [match[2], ...childrenArray.slice(1)];
        } else if (firstChild.trim() === '•' || firstChild.trim() === '-' || firstChild.trim() === '◦' || firstChild.trim() === '▪') {
           isBullet = true;
           bulletChar = firstChild.trim();
           restContent = childrenArray.slice(1);
        } else if (firstChild.startsWith('•') || firstChild.startsWith('-') || firstChild.startsWith('◦') || firstChild.startsWith('▪')) {
           isBullet = true;
           bulletChar = firstChild.charAt(0);
           restContent = [firstChild.slice(1).trimStart(), ...childrenArray.slice(1)];
        }
      }
    }

    if (isBullet) {
      return (
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '0.8rem' }} {...props}>
          <span style={{ flexShrink: 0 }}>{bulletChar}&nbsp;</span>
          <div style={{ flex: 1 }}>{restContent}</div>
        </div>
      );
    }

    return <p style={{lineHeight: '1.7', marginBottom: '0.8rem'}} {...props}>{children}</p>;
  }
};
