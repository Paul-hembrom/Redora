import fs from 'fs';

let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');

content = content.replace(
`                      summarizingChapters={summarizingChapters}
                      isStudent={isStudent}
                    />`,
`                      summarizingChapters={summarizingChapters}
                      isReadOnly={isDocStudent}
                    />`);

fs.writeFileSync('src/components/Sidebar.tsx', content);
console.log('done');
