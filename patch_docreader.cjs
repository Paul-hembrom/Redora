const fs = require('fs');
const path = 'src/components/DocumentReader.tsx';
let content = fs.readFileSync(path, 'utf8');

const providerImport = "import { markdownComponents, QuestionContext } from './MarkdownComponents';";
content = content.replace("import { markdownComponents } from './MarkdownComponents';", providerImport);

const chapterContentReplace = `return blocks.map((s, idx) => (
                      <QuestionContext.Provider key={idx} value={{
                        blockText: s,
                        grade: 'High School',
                        subject: 'General Education',
                        topic: chapter.title
                      }}>
                        <div id={\`tts-chapter-\${idx}\`}>
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {s}
                          </ReactMarkdown>
                        </div>
                      </QuestionContext.Provider>
                    ));`;

content = content.replace(/return blocks\.map\(\(s, idx\) => \(\s*<div key=\{idx\} id=\{\`tts-chapter-\$\{idx\}\`\}>\s*<ReactMarkdown\s*remarkPlugins=\{\[remarkGfm\]\}\s*components=\{markdownComponents\}\s*>\s*\{s\}\s*<\/ReactMarkdown>\s*<\/div>\s*\)\);/, chapterContentReplace);

fs.writeFileSync(path, content);
