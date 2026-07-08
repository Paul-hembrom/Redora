import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const startMarker = "app.post('/api/retrieve-videos', authenticate, retrieveVideosLimiter, async (req: any, res) => {";
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) throw new Error("Could not find retrieve-videos start");

// Find where it should end (the end of the topics/:id/images route)
// The route after images is /api/tts/elevenlabs or /api/lessons/study-plan
// Let's find the end of the mangled section.
const endMarker = "app.post('/api/tts/elevenlabs', async (req, res) => {";
let endIdx = content.indexOf(endMarker);

if (endIdx === -1) {
  endIdx = content.indexOf("app.post('/api/lessons/study-plan',");
}
if (endIdx === -1) throw new Error("Could not find end marker");

// Reconstruct the retrieve-videos route
const retrieveVideosRoute = `app.post('/api/retrieve-videos', authenticate, retrieveVideosLimiter, async (req: any, res) => {
  try {
    try {
      await verifyAndIncrementUsage(req.userId, 'youtube', req.body.org_id || req.query.org_id || req.cookies?.['sb-org-id']);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    const { title, summary, content, subject, grade, keyConcepts, class_context, search_queries } = req.body;
    const ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        retryOptions: {
          attempts: 2
        }
      }
    });

    const conceptsStr = Array.isArray(keyConcepts) ? keyConcepts.join(', ') : '';
    const contextPrefix = class_context ? \`Class Context: \${class_context}\` : \`Grade Level: \${grade}\`;
    const prompt = \`You are an expert Educational Video Retrieval Engine.
Your task is to find the best educational YouTube videos for a specific chapter context.

\${contextPrefix}
Chapter Title: \${title}
Subject: \${subject}
Summary: \${summary || ''}
Content Snippet: \${content ? content.substring(0, 1500) : ''}
Key Concepts: \${conceptsStr}

Step 1: Extract the core learning intent from the chapter summary and content snippet.
Step 2: Break down the learning intent into key concepts (especially visual ones).
Step 3: Generate 5-10 highly optimized YouTube search queries suitable for the specified class context. If Class Context is provided, strongly prefix or bias the search queries with it (e.g. "\${class_context}: Photosynthesis animation").
Step 4: Predict ideal videos and assign a "quality_score" out of 100 based on expected educational clarity, animation quality, and context match.

Return ONLY valid JSON exactly matching this schema:
{
  "chapter": "string",
  "learning_intent": "string",
  "intent_quality_score": number,
  "key_concepts": ["string"],
  "search_queries": ["string"],
  "recommended_videos": [
    {
      "title": "string",
      "channel": "string",
      "reason": "string",
      "search_query_used": "string",
      "video_id": "string",
      "embed_type": "string",
      "quality_score": number
    }
  ]
}
Leave "video_id" empty if unsure, do not invent 11-char IDs.\`;

    let responseText = '{}';
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });
      responseText = response.text || '{}';
    } catch (geminiError: any) {
      console.warn("Gemini retrieve-videos failed:", geminiError.message, "- trying DeepSeek fallback");
      const dsKey = process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY;
      let dsSucceeded = false;
      if (dsKey) {
        try {
          const dsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': \`Bearer \${dsKey}\`
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [{ role: 'user', content: prompt }],
              response_format: { type: 'json_object' }
            })
          });
          
          if (dsRes.ok) {
            const dsData = await dsRes.json();
            responseText = dsData.choices[0].message.content || '{}';
            dsSucceeded = true;
          } else {
            console.warn("DeepSeek fallback failed with status:", dsRes.status);
          }
        } catch (dsError) {
          console.warn("DeepSeek fetch failed:", dsError);
        }
      }

      if (!dsSucceeded) {
        console.warn("Using Fallback #2 for retrieve-videos.");
        const fallbackQueries = search_queries || [\`\${title} \${keyConcepts?.slice(0,3).join(' ') || ''}\`.trim(), title];
        responseText = JSON.stringify({
          chapter: title,
          learning_intent: summary || title,
          intent_quality_score: 50,
          key_concepts: keyConcepts || [],
          search_queries: fallbackQueries,
          recommended_videos: fallbackQueries.map(q => ({
            title: q,
            search_query_used: q,
            quality_score: 50
          }))
        });
      }
    }

    console.log("LLM response text:", responseText);
    let parsedData;
    try {
      parsedData = JSON.parse(responseText.trim().replace(/^\\s*\`\`\`json/, '').replace(/\`\`\`\\s*$/, ''));
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    if (!parsedData.recommended_videos || !Array.isArray(parsedData.recommended_videos)) {
      return res.json({ videos: [] });
    }

    // Grounding with yt-search
    const groundedVideos = [];
    for (const vid of parsedData.recommended_videos) {
      if (!vid.video_id || vid.video_id.length !== 11) {
        try {
          const searchResult = await ytSearch(vid.search_query_used || vid.title);
          if (searchResult && searchResult.videos.length > 0) {
            vid.video_id = searchResult.videos[0].videoId;
            vid.real_title = searchResult.videos[0].title;
            if (!vid.channel) vid.channel = searchResult.videos[0].author.name;
          }
        } catch (e) {
          console.error("YT Search Error:", e);
        }
      }
      
      if (vid.video_id && vid.video_id.length === 11) {
        groundedVideos.push(vid);
      }
    }

    // Sort by quality score desc
    groundedVideos.sort((a, b) => b.quality_score - a.quality_score);
    parsedData.recommended_videos = groundedVideos;

    res.json(parsedData);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
`;

const imagesRoute = `app.post('/api/topics/:id/images', authenticate, imagesLimiter, async (req: any, res) => {
  try {
    try {
      await verifyAndIncrementUsage(req.userId, 'image', req.body.org_id || req.query.org_id || req.cookies?.['sb-org-id']);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    const { org_context, title, key_concepts, summary } = req.body;
    
    const conceptsStr = Array.isArray(key_concepts) ? key_concepts.join(', ') : '';
    const keywordPrompt = \`You are an Educational Search Assistant. Your job is to extract a single, precise, physical or scientific search keyword from the provided chapter and subtopics that can be used on photo/diagram search engines. Return ONLY a JSON object matching this format: {"keyword": "string"}

Chapter Title: \${title}
Key Concepts: \${conceptsStr}\`;

    let searchQuery = \`\${title} \${conceptsStr}\`.substring(0, 50).trim();
    try {
      const raw = await callLLM(keywordPrompt, undefined, 'json_object');
      const parsed = JSON.parse(raw);
      if (parsed.keyword) {
        searchQuery = parsed.keyword.trim();
      }
    } catch (err) {
      console.error("DeepSeek query generation failed, using fallback query", err);
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
        
        const rawKroki = await callLLM(krokiPrompt);
        const cleanedMermaid = rawKroki.replace(/\`\`\`mermaid\\s*/gi, '').replace(/\`\`\`\\s*/gi, '').trim();
        
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

    res.json({ images });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
`;

content = content.substring(0, startIdx) + retrieveVideosRoute + "\n" + imagesRoute + "\n" + content.substring(endIdx);
fs.writeFileSync('server.ts', content);
console.log('Update complete');
