import fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf8');

const unauthFind = `const targetChapter = data.chapters.find((c: any) => c.title === subtopic);`;
const unauthReplace = `
                    let targetChapter;
                    for (const chap of data.chapters) {
                        if (chap.title === subtopic) { targetChapter = chap; break; }
                        if (chap.children) {
                            const found = chap.children.find((child: any) => child.title === subtopic);
                            if (found) { targetChapter = found; break; }
                        }
                    }
`;
code = code.replace(unauthFind, unauthReplace);

const authFind = `targetDisplay = currDoc.chapters.find((c: any) => c.title === subtopic);`;
const authReplace = `
                          for (const chap of currDoc.chapters) {
                              if (chap.title === subtopic) { targetDisplay = chap; break; }
                              if (chap.children) {
                                  const found = chap.children.find((child: any) => child.title === subtopic);
                                  if (found) { targetDisplay = found; break; }
                              }
                          }
`;
code = code.replace(authFind, authReplace);

fs.writeFileSync('src/App.tsx', code);
