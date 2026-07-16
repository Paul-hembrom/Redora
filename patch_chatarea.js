import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// Fix 1: Provide authorization token to all fetch('/api/chats*')
code = code.replace(/fetch\('\/api\/chats', \{\n\s*method: 'POST',\n\s*headers: \{ 'Content-Type': 'application\/json' \},/g, 
`fetch('/api/chats', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` } : {})
        },`);

code = code.replace(/fetch\(\`\/api\/chats\/\$\{encodeURIComponent\(chapter\.id\)\}\`\)/g,
`fetch(\`/api/chats/\${encodeURIComponent(chapter.id)}\`, {
      headers: {
        ...(localStorage.getItem('token') ? { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` } : {})
      }
    })`);

// Fix 2: Remove sentence splitting from chapter.content rendering
// We look for:
// const content = smartNormalizeText(typeof chapter.content === 'string' ? chapter.content : '');
// let sentences: string[] = content.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [];
// ...
// })()}
// And replace it with a simple ReactMarkdown render

const contentRenderOld = `                  {(() => {
                    const content = smartNormalizeText(typeof chapter.content === 'string' ? chapter.content : '');
                    let sentences: string[] = content.match(/[^.!?]+[.!?]+(\\s|$)|[^.!?]+$/g) || [];
                    if (!sentences.length) { sentences = [content]; } else { sentences = sentences.map(s => s.trim()).filter(Boolean); }
                    
                    return sentences.map((s, idx) => (
                      <span key={idx} id={\`tts-sentence-\${idx}\`}>
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            ...markdownComponents,
                            p: ({node, children, ...props}) => <span {...props}>{children} </span>
                          }}
                        >
                          {s}
                        </ReactMarkdown>
                      </span>
                    ));
                  })()}`;

const contentRenderNew = `                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {smartNormalizeText(typeof chapter.content === 'string' ? chapter.content : '')}
                  </ReactMarkdown>`;

code = code.replace(contentRenderOld, contentRenderNew);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched ChatArea!");
