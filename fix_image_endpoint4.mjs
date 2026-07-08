import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const startMarker = "app.post('/api/topics/:id/images', authenticate, imagesLimiter, async (req: any, res) => {";
const endMarker = "app.post('/api/tts/elevenlabs', async (req, res) => {";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) throw new Error("Could not find markers");

const replacement = `app.post('/api/topics/:id/images', authenticate, imagesLimiter, async (req: any, res) => {
  try {
    try {
      await verifyAndIncrementUsage(req.userId, 'image', req.body.org_id || req.query.org_id || req.cookies?.['sb-org-id']);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    const { org_context, title, key_concepts, summary } = req.body;
    
    const conceptsStr = Array.isArray(key_concepts) ? key_concepts.join(', ') : '';
    const keywordPrompt = \`You are an Educational Search Assistant. Based on the chapter title, key concepts, and a detailed content summary, generate a single, precise search keyword that can be used on a photo/diagram search engine to find a relevant educational image. Return ONLY a JSON object: {"keyword": "string"}

Chapter Title: \${title}
Key Concepts: \${conceptsStr}
Content Summary: \${summary ? summary.substring(0, 1000) : ''}\`;

    let searchQuery = '';
    try {
      const raw = await callLLM(keywordPrompt, undefined, 'json_object');
      const parsed = JSON.parse(raw);
      if (parsed.keyword) {
        searchQuery = parsed.keyword.trim();
      }
    } catch (err) {
      console.error("DeepSeek query generation failed, using fallback query", err);
      // Smarter fallback
      const stopWords = new Set(["a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is", "it", "no", "not", "of", "on", "or", "such", "that", "the", "their", "then", "there", "these", "they", "this", "to", "was", "will", "with"]);
      let words = (summary || "").toLowerCase().replace(/[^a-z0-9\\s]/g, '').split(/\\s+/).filter((w: string) => w.length > 2 && !stopWords.has(w));
      let wordCounts: Record<string, number> = {};
      words.forEach((w: string) => { wordCounts[w] = (wordCounts[w] || 0) + 1; });
      let topWords = Object.keys(wordCounts).sort((a, b) => wordCounts[b] - wordCounts[a]).slice(0, 3).join(' ');
      searchQuery = \`\${title} \${topWords || conceptsStr}\`.substring(0, 50).trim();
    }
    
    // Ensure we have a fallback if even the above is empty
    if (!searchQuery) {
      searchQuery = title;
    }

    const pexelsKey = process.env.IMAGE_SEARCH_API_KEY;
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    
    async function fetchImagesForQuery(query: string) {
      const imgs: any[] = [];
      if (pexelsKey) {
        try {
          const pexelsRes = await fetch(\`https://api.pexels.com/v1/search?query=\${encodeURIComponent(query)}&per_page=6\`, {
            headers: { Authorization: pexelsKey }
          });
          if (pexelsRes.ok) {
            const data = await pexelsRes.json();
            if (data.photos && data.photos.length > 0) {
              for (const photo of data.photos) {
                imgs.push({
                  url: photo.src.large || photo.src.original,
                  thumbnail: photo.src.medium,
                  alt: photo.alt || \`Image for \${query}\`,
                  source: "pexels"
                });
              }
            }
          }
        } catch (err) {
          console.error("Pexels search failed", err);
        }
      }
      
      if (imgs.length === 0 && unsplashKey) {
        try {
          const unsplashRes = await fetch(\`https://api.unsplash.com/search/photos?query=\${encodeURIComponent(query)}&per_page=6\`, {
            headers: { Authorization: \`Client-ID \${unsplashKey}\` }
          });
          if (unsplashRes.ok) {
            const data = await unsplashRes.json();
            if (data.results && data.results.length > 0) {
              for (const photo of data.results) {
                imgs.push({
                  url: photo.urls.regular || photo.urls.full,
                  thumbnail: photo.urls.small,
                  alt: photo.alt_description || \`Image for \${query}\`,
                  source: "unsplash"
                });
              }
            }
          }
        } catch (err) {
          console.error("Unsplash search failed", err);
        }
      }

      if (imgs.length === 0) {
        try {
          const wikiUrl = \`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=\${encodeURIComponent(query + " diagram")}&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&origin=*\`;
          const wikiRes = await fetch(wikiUrl);
          if (wikiRes.ok) {
            const wikiData = await wikiRes.json();
            const pages = wikiData.query?.pages;
            if (pages) {
              for (const pageId in pages) {
                const info = pages[pageId].imageinfo?.[0];
                if (info?.url) {
                  imgs.push({ url: info.url, thumbnail: info.url, alt: query, source: "wikimedia-commons" });
                  if (imgs.length >= 3) break;
                }
              }
            }
          }
        } catch (err) {
          console.error("Wikimedia Commons search failed", err);
        }
      }
      return imgs;
    }

    let images = await fetchImagesForQuery(searchQuery);
    let message = undefined;

    // Relevance Check
    if (images.length > 0) {
      const combinedText = images.map(img => (img.alt || "").toLowerCase()).join(" ");
      const titleWords = title.toLowerCase().split(/\\s+/);
      const conceptWords = conceptsStr.toLowerCase().split(/[\\s,]+/);
      const checkWords = [...titleWords, ...conceptWords].filter(w => w.length > 2);
      
      const isRelevant = checkWords.some(w => combinedText.includes(w));
      
      if (!isRelevant && checkWords.length > 0) {
        console.log(\`Images flagged as irrelevant for '\${searchQuery}'. Retrying with broader keyword.\`);
        // Broader keyword: Title + First key concept
        const firstConcept = Array.isArray(key_concepts) && key_concepts.length > 0 ? key_concepts[0] : '';
        const broaderQuery = \`\${title} \${firstConcept}\`.trim();
        const retryImages = await fetchImagesForQuery(broaderQuery);
        
        if (retryImages.length > 0) {
           images = retryImages;
        } else {
           message = "Images may not be perfectly relevant. Try refining your search.";
        }
      }
    }

    if (images.length === 0 && req.body.generateDiagram === true) {
      try {
        const krokiPrompt = \`Generate a simple Mermaid.js diagram description for the following topic. Only return the Mermaid code, no other text.
Topic: \${title} (\${conceptsStr})\`;
        
        const rawKroki = await callLLM(krokiPrompt);
        const cleanedMermaid = rawKroki.replace(/\\\`\\\`\\\`mermaid\\s*/gi, '').replace(/\\\`\\\`\\\`\\s*/gi, '').trim();
        
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
    }

    res.json(message ? { images, message } : { images });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
`

content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
fs.writeFileSync('server.ts', content);
console.log("Update complete");
