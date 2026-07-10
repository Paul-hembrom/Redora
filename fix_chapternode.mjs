import fs from 'fs';

let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');

// Update ChapterNodeProps
content = content.replace(
`  summarizingChapters?: Set<string>;
}`,
`  summarizingChapters?: Set<string>;
  isReadOnly?: boolean;
}`);

// Update ChapterNode signature
content = content.replace(
`  onSummarizeChapter,
  summarizingChapters
}: ChapterNodeProps) => {`,
`  onSummarizeChapter,
  summarizingChapters,
  isReadOnly
}: ChapterNodeProps) => {`);

// Inside ChapterNode, replace !isStudent with !isReadOnly
const chapterNodeStart = content.indexOf(`const ChapterNode = ({`);
const chapterNodeEnd = content.indexOf(`export default function Sidebar`);
let chapterNodeSection = content.substring(chapterNodeStart, chapterNodeEnd);
chapterNodeSection = chapterNodeSection.replace(/!isStudent && \(/g, '!isReadOnly && (');
chapterNodeSection = chapterNodeSection.replace(/!isStudent && <button/g, '!isReadOnly && <button');
content = content.substring(0, chapterNodeStart) + chapterNodeSection + content.substring(chapterNodeEnd);

// When ChapterNode calls itself recursively
content = content.replace(
`              summarizingChapters={summarizingChapters}
            />`,
`              summarizingChapters={summarizingChapters}
              isReadOnly={isReadOnly}
            />`);

// When Sidebar calls ChapterNode
content = content.replace(
`                      summarizingChapters={summarizingChapters}
                    />`,
`                      summarizingChapters={summarizingChapters}
                      isReadOnly={isDocStudent}
                    />`);

fs.writeFileSync('src/components/Sidebar.tsx', content);
console.log('done');
