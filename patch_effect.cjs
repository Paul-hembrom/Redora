const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const anchor = "const safeDocuments = Array.isArray(documents) ? documents : [];";
const newCode = `useEffect(() => {
    if (selectedDocId) {
      const doc = Array.isArray(documents) ? documents.find(d => d.id === selectedDocId) : undefined;
      if (doc && doc.chapters && doc.chapters.length > 0) {
        const flat = flattenChapters(doc.chapters);
        if (selectedChapterId !== 'read_all' && !flat.some(c => c.id === selectedChapterId)) {
          setSelectedChapterId(flat[0].id);
        }
      }
    }
  }, [selectedDocId, documents, selectedChapterId]);

  const safeDocuments = Array.isArray(documents) ? documents : [];`;

code = code.replace(anchor, newCode);
fs.writeFileSync('src/App.tsx', code);
