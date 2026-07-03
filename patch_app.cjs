const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const fetchBlockRegex = /try \{\n\s*const docsRes = await fetch\('\/api\/documents'\);\n\s*if \(docsRes\.ok\) \{\n\s*const data = await docsRes\.json\(\);\n\s*if \(Array\.isArray\(data\)\) \{\n\s*setDocuments\(data\);\n\s*import\('\.\/lib\/offline'\)\.then\(m => m\.cacheDocuments\(data\)\);\n\s*\}\n\s*\}\n\s*\} catch \(e\) \{\n\s*console\.error\('Failed to refetch documents after upload', e\);\n\s*\}/;

const newFetchBlock = `try {
          const docsRes = await fetch('/api/documents');
          if (docsRes.ok) {
            const data = await docsRes.json();
            if (Array.isArray(data)) {
              setDocuments(data);
              import('./lib/offline').then(m => m.cacheDocuments(data));
              
              // Find the newly uploaded document (by tempDocId which was preserved, or just use the response if available)
              const newDocInList = data.find((d: any) => d.id === finalDoc.id);
              if (newDocInList) {
                setSelectedDocId(newDocInList.id);
                // Clear selectedChapter or currentChapterId state so the reader shows the new book's first chapter
                if (newDocInList.chapters && newDocInList.chapters.length > 0) {
                  setSelectedChapterId(newDocInList.chapters[0].id);
                } else {
                  setSelectedChapterId(null);
                }
              }
            }
          }
        } catch (e) {
          console.error('Failed to refetch documents after upload', e);
        }`;

code = code.replace(fetchBlockRegex, newFetchBlock);
fs.writeFileSync('src/App.tsx', code);
