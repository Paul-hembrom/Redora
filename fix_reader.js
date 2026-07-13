import fs from 'fs';
let code = fs.readFileSync('src/components/DocumentReader.tsx', 'utf8');
const search = "textContent += `$\n                  {(() => {\n                    const content = chapter.content || '';\n                    const sentences = content.match(/[^.!?]+[.!?]+(\\s|$)|[^.!?]+$/g) || [content];\n                    return sentences.map((s, idx) => (\n                      <span key={idx} id={`tts-sentence-${idx}`}>{s}</span>\n                    ));\n                  })()}\n\\n\\n`;";

code = code.replace(search, "textContent += `${chapter.content}\\n\\n`;");
fs.writeFileSync('src/components/DocumentReader.tsx', code);
