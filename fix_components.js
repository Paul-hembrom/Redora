import fs from 'fs';

// 1. ChatArea
let chatCode = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const oldChatSearch = `<ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {smartNormalizeText(chapter.content)}
                  </ReactMarkdown>`;

const newChatReplace = `{(() => {
                    const content = smartNormalizeText(typeof chapter.content === 'string' ? chapter.content : '');
                    let sentences = content.match(/[^.!?]+[.!?]+(\\s|$)|[^.!?]+$/g);
                    if (!sentences) {
                      sentences = [content];
                    } else {
                      sentences = sentences.map(s => s.trim()).filter(Boolean);
                    }
                    
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

chatCode = chatCode.replace(oldChatSearch, newChatReplace);
fs.writeFileSync('src/components/ChatArea.tsx', chatCode);


// 2. DocumentReader
let readerCode = fs.readFileSync('src/components/DocumentReader.tsx', 'utf8');
const oldReaderSearch = `{chapter.content}`;
const newReaderReplace = `{(() => {
                    const content = typeof chapter.content === 'string' ? chapter.content : '';
                    let sentences = content.match(/[^.!?]+[.!?]+(\\s|$)|[^.!?]+$/g);
                    if (!sentences) {
                      sentences = [content];
                    } else {
                      sentences = sentences.map(s => s.trim()).filter(Boolean);
                    }
                    
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

readerCode = readerCode.replace(oldReaderSearch, newReaderReplace);
fs.writeFileSync('src/components/DocumentReader.tsx', readerCode);
