import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const targetStartStr = "    if (images.length === 0) {\n      return res.json({ images: [], message: \"No images found. Try searching for videos instead.\" });\n    }";
const targetStart = content.indexOf(targetStartStr);

if (targetStart === -1) throw new Error('Target block not found');

const newCode = `    if (images.length === 0) {
      try {
        const wikiUrl = \`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=\${encodeURIComponent(searchQuery + " diagram")}&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&origin=*\`;
        const wikiRes = await fetch(wikiUrl);
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          const pages = wikiData.query?.pages;
          if (pages) {
            for (const pageId in pages) {
              const info = pages[pageId].imageinfo?.[0];
              if (info?.url) {
                images.push({ url: info.url, thumbnail: info.url, alt: searchQuery, source: "wikimedia-commons" });
                if (images.length >= 3) break;
              }
            }
          }
        }
      } catch (err) {
        console.error("Wikimedia Commons search failed", err);
      }
    }

    if (images.length === 0 && req.body.generateDiagram === true) {
      try {
        const krokiPrompt = \`Generate a simple Mermaid.js diagram description for the following topic. Only return the Mermaid code, no other text.
Topic: \${title} (\${conceptsStr})\`;
        const krokiResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: krokiPrompt
        });
        const mermaidCodeText = krokiResponse.text || '';
        const cleanedMermaid = mermaidCodeText.replace(/\`\`\`mermaid\\s*/gi, '').replace(/\`\`\`\\s*/gi, '').trim();
        
        if (cleanedMermaid) {
           const krokiUrl = \`https://kroki.io/mermaid/svg/\${encodeURIComponent(cleanedMermaid)}\`;
           images.push({
             url: krokiUrl,
             thumbnail: krokiUrl,
             alt: \`Diagram for \${title}\`,
             source: "kroki"
           });
        }
      } catch (err) {
        console.error("Kroki diagram generation failed", err);
      }
    }

    if (images.length === 0) {
      return res.json({ images: [], message: "No images found. Try searching for videos instead." });
    }`;

content = content.replace(targetStartStr, newCode);
fs.writeFileSync('server.ts', content);
console.log('Update complete');
