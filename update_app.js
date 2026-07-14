import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace the first one (anonymous)
const search1 = `      fetch(\`/api/curriculum?grade=\${encodeURIComponent(grade)}&subject=\${encodeURIComponent(subject)}\`)
        .then(res => {
          if (res.ok) {
            return res.text().then(text => {
              try {
                return JSON.parse(text);
              } catch (e) {
                console.error("JSON parsing error:", e, "Raw text:", text.substring(0, 500));
                throw new Error('MalformedJSON');
              }
            });
          }
          throw new Error('FetchFailed');
        })`;
        
const replace1 = `      fetch(\`/api/curriculum?grade=\${encodeURIComponent(grade)}&subject=\${encodeURIComponent(subject)}\`)
        .then(res => {
          if (res.ok) {
            return res.text().then(text => {
              console.log('Curriculum raw response:', text.substring(0, 500));
              try {
                return JSON.parse(text);
              } catch (e) {
                console.error("JSON parsing error:", e, "Full text:", text);
                throw new Error('MalformedJSON');
              }
            });
          }
          throw new Error('FetchFailed');
        })`;

code = code.replace(search1, replace1);

// Replace the second one (authenticated)
const search2 = `                const currRes = await fetch(\`/api/curriculum?grade=\${encodeURIComponent(grade)}&subject=\${encodeURIComponent(subject)}\`);
                if (currRes.ok) {
                  const rawText = await currRes.text();
                  let currDoc;
                  try {
                    currDoc = JSON.parse(rawText);
                  } catch (e) {
                    console.error("JSON parsing error:", e, "Raw text:", rawText.substring(0, 500));
                    setCurriculumError("Curriculum data is malformed. Please contact support.");
                    setIsCurriculumLoading(false);
                    return;
                  }`;

const replace2 = `                const currRes = await fetch(\`/api/curriculum?grade=\${encodeURIComponent(grade)}&subject=\${encodeURIComponent(subject)}\`);
                if (currRes.ok) {
                  const rawText = await currRes.text();
                  console.log('Curriculum raw response:', rawText.substring(0, 500));
                  let currDoc;
                  try {
                    currDoc = JSON.parse(rawText);
                  } catch (e) {
                    console.error("JSON parsing error:", e, "Full text:", rawText);
                    setCurriculumError("Curriculum data is malformed. Please contact support.");
                    setIsCurriculumLoading(false);
                    return;
                  }`;

code = code.replace(search2, replace2);

fs.writeFileSync('src/App.tsx', code);
