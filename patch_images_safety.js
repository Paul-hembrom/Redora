import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const targetCheck = `        images = await fetchImagesForQuery(searchQuery);

        // Relevance check
        if (images.length > 0) {
           const firstAlt = (images[0].alt || "").toLowerCase();
           const topicWords = subtopic.toLowerCase().split(/\\s+/).concat(subject.toLowerCase().split(/\\s+/));
           const checkWords = [...topicWords].filter(w => w.length > 2);
           const isRelevant = checkWords.length === 0 || checkWords.some(w => firstAlt.includes(w));
           if (!isRelevant) {
              const broaderQuery = \`\${subject} \${title}\`.trim();
              const retryImages = await fetchImagesForQuery(broaderQuery);
              if (retryImages.length > 0) {
                 images = retryImages;
              }
           }
        }`;

const replacementCheck = `        images = await fetchImagesForQuery(searchQuery);

        // Safety filter
        const unsafeWords = ["woman", "model", "fashion", "lingerie", "sexy", "bikini", "girl", "boy", "man", "attractive", "beautiful", "handsome"];
        images = images.filter(img => {
            const alt = (img.alt || "").toLowerCase();
            return !unsafeWords.some(w => alt.includes(w));
        });

        if (images.length === 0) {
           console.log("Images filtered or empty. Retrying with educational diagram keyword.");
           const safeQuery = \`\${subtopic} educational diagram\`;
           images = await fetchImagesForQuery(safeQuery);
           images = images.filter(img => {
               const alt = (img.alt || "").toLowerCase();
               return !unsafeWords.some(w => alt.includes(w));
           });
        }

        // Relevance check
        if (images.length > 0) {
           const firstAlt = (images[0].alt || "").toLowerCase();
           const topicWords = subtopic.toLowerCase().split(/\\s+/).concat(subject.toLowerCase().split(/\\s+/));
           const checkWords = [...topicWords].filter(w => w.length > 2);
           const isRelevant = checkWords.length === 0 || checkWords.some(w => firstAlt.includes(w));
           if (!isRelevant) {
              const broaderQuery = \`\${subject} \${title}\`.trim();
              let retryImages = await fetchImagesForQuery(broaderQuery);
              retryImages = retryImages.filter(img => {
                  const alt = (img.alt || "").toLowerCase();
                  return !unsafeWords.some(w => alt.includes(w));
              });
              if (retryImages.length > 0) {
                 images = retryImages;
              }
           }
        }`;

if (code.includes(targetCheck)) {
    code = code.replace(targetCheck, replacementCheck);
    fs.writeFileSync('server.ts', code);
    console.log("Patched safety check");
} else {
    console.log("Target check not found");
}

