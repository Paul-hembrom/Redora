import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const badSearch = `{(() => {
                    const normalized = smartNormalizeText(chapter.content);
                    const sentences = normalized.match(/[^.!?]+[.!?]+(\\s|$)|[^.!?]+$/g) || [normalized];
                    return sentences.map((s, idx) => (
                      <span key={idx} id={\`tts-sentence-\${idx}\`}>
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            ...markdownComponents,
                            p: ({node, children, ...props}: any) => <span {...props}>{children}</span>
                          }}
                        >
                          {s}
                        </ReactMarkdown>
                      </span>
                    ));
                  })()}`;

const goodReplace = `<ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {smartNormalizeText(chapter.content)}
                  </ReactMarkdown>`;

code = code.replace(badSearch, goodReplace);
fs.writeFileSync('src/components/ChatArea.tsx', code);
