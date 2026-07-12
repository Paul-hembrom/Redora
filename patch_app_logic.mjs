import fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace authenticated block
const replaceBlockAuth = `const source = urlParams.get('source');
            const grade = urlParams.get('grade');
            const subject = urlParams.get('subject');
            const subtopic = urlParams.get('subtopic');
            
            if (source === 'curriculum' && grade && subject) {
              try {
                const currRes = await fetch(\`/api/curriculum?grade=\${encodeURIComponent(grade)}&subject=\${encodeURIComponent(subject)}\`);
                if (currRes.ok) {
                  const currDoc = await currRes.json();
                  if (currDoc) {
                    docs = [currDoc, ...docs];
                    setSelectedDocId(currDoc.id);
                    if (currDoc.chapters && currDoc.chapters.length > 0) {
                      let targetDisplay;
                      if (subtopic) {
                          // Try to find the exact subtopic
                          targetDisplay = currDoc.chapters.find((c: any) => c.title === subtopic);
                      }
                      
                      if (!targetDisplay) {
                          targetDisplay = currDoc.chapters.find((c: any) => c.type === 'topic');
                      }
                      
                      if (!targetDisplay) {
                          const firstChap = currDoc.chapters[0];
                          if (firstChap && firstChap.children && firstChap.children.length > 0) {
                              targetDisplay = firstChap.children[0];
                          } else {
                              targetDisplay = firstChap;
                          }
                      }
                      setSelectedChapterId(targetDisplay?.id);
                    }
                  } else {
                    setUploadError("Curriculum content not yet available for this grade and subject.");
                  }
                } else {
                   setUploadError("Curriculum content not yet available for this grade and subject.");
                }
              } catch (err) {`;

code = code.replace(/const source = urlParams\.get\('source'\);\n\s*const grade = urlParams\.get\('grade'\);\n\s*const subject = urlParams\.get\('subject'\);[\s\S]*?catch\s*\(err\)\s*\{/, replaceBlockAuth);


const unauthBlockOld = `fetch(\`/api/curriculum?grade=\${encodeURIComponent(grade)}&subject=\${encodeURIComponent(subject)}\`)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Not found');
        })
        .then(data => {
          if (data) setSharedPublicDoc(data);
          else alert("Curriculum content not yet available for this grade and subject.");
        })`;

const unauthBlockNew = `fetch(\`/api/curriculum?grade=\${encodeURIComponent(grade)}&subject=\${encodeURIComponent(subject)}\`)
        .then(async res => {
          if (res.ok) {
            const data = await res.json();
            if (data) {
                // If there's a subtopic, we might want to pass it to the DocumentReader somehow, 
                // but for now, DocumentReader selects the first chapter by default.
                // We'll update DocumentReader later or just pass it in URL.
                // But App.tsx sets sharedPublicDoc here.
                setSharedPublicDoc(data);
                
                // Set the selected chapter if a subtopic was specified.
                if (subtopic && data.chapters) {
                    const targetChapter = data.chapters.find((c: any) => c.title === subtopic);
                    if (targetChapter) {
                        // we need to set selectedChapterId somehow, but for unauth user, 
                        // App.tsx uses selectedChapterId as well!
                        setSelectedChapterId(targetChapter.id);
                    }
                }
            } else {
                alert("Curriculum content not yet available for this grade and subject.");
            }
          } else {
            alert("Curriculum content not yet available for this grade and subject.");
          }
        })`;

code = code.replace(unauthBlockOld, unauthBlockNew);

fs.writeFileSync('src/App.tsx', code);
