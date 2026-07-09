import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const targetStr = "if (sharedDocId && !docs.some(d => d.id === sharedDocId)) {";
const idx = content.indexOf(targetStr);

const insertion = `
            const source = urlParams.get('source');
            const grade = urlParams.get('grade');
            const subject = urlParams.get('subject');
            
            if (source === 'curriculum' && grade && subject) {
              try {
                const currRes = await fetch(\`/api/curriculum?grade=\${encodeURIComponent(grade)}&subject=\${encodeURIComponent(subject)}\`);
                if (currRes.ok) {
                  const currDoc = await currRes.json();
                  if (currDoc) {
                    docs = [currDoc, ...docs];
                    setSelectedDocId(currDoc.id);
                    if (currDoc.chapters && currDoc.chapters.length > 0) {
                      // find first topic or part
                      const firstDisplay = currDoc.chapters.find((c: any) => c.type === 'topic') || currDoc.chapters[0];
                      setSelectedChapterId(firstDisplay.id);
                    }
                  } else {
                    setUploadError("This curriculum content is not yet available.");
                  }
                } else {
                   setUploadError("Failed to fetch curriculum content.");
                }
              } catch (err) {
                 console.error("Failed to fetch curriculum:", err);
                 setUploadError("Failed to fetch curriculum content.");
              }
            }
            
            `;

content = content.substring(0, idx) + insertion + content.substring(idx);

// Add the same logic for when user is NOT logged in.
// "if (sharedDocId) {" in first useEffect
const targetStr2 = "if (sharedDocId) {";
const idx2 = content.indexOf(targetStr2);

const insertion2 = `
    const source = urlParams.get('source');
    const grade = urlParams.get('grade');
    const subject = urlParams.get('subject');
    
    if (source === 'curriculum' && grade && subject) {
      if (user) return; // Handled in the main fetch below
      
      fetch(\`/api/curriculum?grade=\${encodeURIComponent(grade)}&subject=\${encodeURIComponent(subject)}\`)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Not found');
        })
        .then(data => {
          if (data) setSharedPublicDoc(data);
          else alert("This curriculum content is not yet available.");
        })
        .catch(console.error);
      return;
    }
    
    `;
    
content = content.substring(0, idx2) + insertion2 + content.substring(idx2);

fs.writeFileSync('src/App.tsx', content);
console.log("Updated App.tsx");
