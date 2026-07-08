import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const routeStart = content.indexOf("app.post('/api/topics/:id/images'");
if (routeStart === -1) throw new Error('Route not found');

const targetStart = content.indexOf('const { org_context, title, key_concepts, summary } = req.body;', routeStart);

const targetEndStr = "res.json({ images });";
const targetEnd = content.indexOf(targetEndStr, targetStart);

if (targetStart === -1 || targetEnd === -1) throw new Error('Target block not found');

const newCode = `const { org_context, title, key_concepts, summary } = req.body;
    const ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        retryOptions: {
          attempts: 2
        }
      }
    });
      
    const conceptsStr = Array.isArray(key_concepts) ? key_concepts.join(', ') : '';
    const prompt = \`Generate a concise, 1-4 word image search query to find high-quality educational diagrams or illustrations about: \${title} (\${conceptsStr}). Return ONLY the query string, nothing else.\`;

    let searchQuery = \`\${title} \${conceptsStr}\`.substring(0, 50).trim();
    try {
      const queryResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      if (queryResponse.text) {
        searchQuery = queryResponse.text.trim();
      }
    } catch (err) {
      console.error("Gemini query generation failed, using fallback query", err);
    }

    const pexelsKey = process.env.IMAGE_SEARCH_API_KEY;
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    const images: any[] = [];

    if (pexelsKey) {
      try {
        const pexelsRes = await fetch(\`https://api.pexels.com/v1/search?query=\${encodeURIComponent(searchQuery)}&per_page=6\`, {
          headers: { Authorization: pexelsKey }
        });
        if (pexelsRes.ok) {
          const data = await pexelsRes.json();
          if (data.photos && data.photos.length > 0) {
            for (const photo of data.photos) {
              images.push({
                url: photo.src.large || photo.src.original,
                thumbnail: photo.src.medium,
                alt: photo.alt || \`Image for \${searchQuery}\`,
                source: "pexels"
              });
            }
          }
        }
      } catch (err) {
        console.error("Pexels search failed", err);
      }
    }
    
    if (images.length === 0 && unsplashKey) {
      try {
        const unsplashRes = await fetch(\`https://api.unsplash.com/search/photos?query=\${encodeURIComponent(searchQuery)}&per_page=6\`, {
          headers: { Authorization: \`Client-ID \${unsplashKey}\` }
        });
        if (unsplashRes.ok) {
          const data = await unsplashRes.json();
          if (data.results && data.results.length > 0) {
            for (const photo of data.results) {
              images.push({
                url: photo.urls.regular || photo.urls.full,
                thumbnail: photo.urls.small,
                alt: photo.alt_description || \`Image for \${searchQuery}\`,
                source: "unsplash"
              });
            }
          }
        }
      } catch (err) {
        console.error("Unsplash search failed", err);
      }
    }

    if (images.length === 0) {
      return res.json({ images: [], message: "No images found. Try searching for videos instead." });
    }

    res.json({ images });`;

content = content.substring(0, targetStart) + newCode + content.substring(targetEnd + targetEndStr.length);
fs.writeFileSync('server.ts', content);
console.log('Update complete');
