import fs from 'fs';
let code = fs.readFileSync('src/components/DocumentReader.tsx', 'utf8');

const exportSearch = `      textContent += \`\${(() => {
                    const content = typeof chapter.content === 'string' ? chapter.content : '';
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
                  })()}\n\n\`;`;

const exportReplace = `      textContent += \`\${typeof chapter.content === 'string' ? chapter.content : ''}\\n\\n\`;`;

code = code.replace(exportSearch, exportReplace);

const renderSearch = `                <div className="prose prose-invert max-w-none text-white/80 whitespace-pre-wrap font-serif leading-relaxed">
                  
                  {chapter.content}

                </div>`;

const renderReplace = `                <div className="prose prose-invert max-w-none text-white/80 whitespace-pre-wrap font-serif leading-relaxed">
                  {(() => {
                    const content = typeof chapter.content === 'string' ? chapter.content : '';
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
                          {smartNormalizeText(s)}
                        </ReactMarkdown>
                      </span>
                    ));
                  })()}
                </div>`;

code = code.replace(renderSearch, renderReplace);

fs.writeFileSync('src/components/DocumentReader.tsx', code);
console.log("Fixed DocumentReader.tsx!");
