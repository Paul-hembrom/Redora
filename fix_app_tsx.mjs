import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
`                    if (currDoc.chapters && currDoc.chapters.length > 0) {
                      // find first topic or part
                      const firstDisplay = currDoc.chapters.find((c: any) => c.type === 'topic') || currDoc.chapters[0];
                      setSelectedChapterId(firstDisplay.id);
                    }`,
`                    if (currDoc.chapters && currDoc.chapters.length > 0) {
                      // find first topic or part
                      let firstDisplay = currDoc.chapters.find((c: any) => c.type === 'topic');
                      if (!firstDisplay) {
                          // Try first chapter's first child
                          const firstChap = currDoc.chapters[0];
                          if (firstChap && firstChap.children && firstChap.children.length > 0) {
                              firstDisplay = firstChap.children[0];
                          } else {
                              firstDisplay = firstChap;
                          }
                      }
                      setSelectedChapterId(firstDisplay?.id);
                    }`);

fs.writeFileSync('src/App.tsx', content);
console.log('done');
