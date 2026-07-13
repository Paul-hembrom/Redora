import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const search = `<ReactMarkdown \n                    remarkPlugins={[remarkGfm]}\n                    components={markdownComponents}\n                  >\n                    {smartNormalizeText(chapter.content)}\n                  </ReactMarkdown>`;

const replacement = `{(() => {
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

code = code.replace(search, replacement);
fs.writeFileSync('src/components/ChatArea.tsx', code);
