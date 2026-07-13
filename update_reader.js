import fs from 'fs';
let code = fs.readFileSync('src/components/DocumentReader.tsx', 'utf8');

const replacement = `
                  {(() => {
                    const content = chapter.content || '';
                    const sentences = content.match(/[^.!?]+[.!?]+(\\s|$)|[^.!?]+$/g) || [content];
                    return sentences.map((s, idx) => (
                      <span key={idx} id={\`tts-sentence-\${idx}\`}>{s}</span>
                    ));
                  })()}
`;

code = code.replace(/{chapter\.content}/g, replacement);
fs.writeFileSync('src/components/DocumentReader.tsx', code);
