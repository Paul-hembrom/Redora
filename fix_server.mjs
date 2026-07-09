import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

// remove the prepended app.get
const targetToRemove = "app.get('/api/curriculum', async (req: any, res) => {";
if (content.startsWith(targetToRemove) || content.trim().startsWith(targetToRemove)) {
  const nextAppGet = content.indexOf("import", 10);
  if (nextAppGet > -1) {
    content = content.substring(nextAppGet);
  }
}

// ensure neither route exists to avoid duplicates
content = content.replace(/app\.post\('\/api\/curriculum\/generate'[\s\S]*?\n\}\);\n/g, "");
content = content.replace(/app\.get\('\/api\/curriculum'[\s\S]*?\n\}\);\n/g, "");

// find where to insert
const insertPoint = content.indexOf("if (process.env.NODE_ENV !== 'production') {");
if (insertPoint === -1) {
   console.log("Could not find insert point.");
   process.exit(1);
}

const curriculumRoutes = `
app.get('/api/curriculum', async (req: any, res) => {
  try {
    const { grade, subject } = req.query;
    if (!grade || !subject) {
      return res.status(400).json({ error: 'grade and subject are required' });
    }
    const rows = await sql\`SELECT * FROM curriculum_library WHERE grade = \${grade} AND subject = \${subject} ORDER BY title, subtopic\`;
    
    if (rows.length === 0) {
      return res.json(null);
    }
    
    // Group by title
    const docId = \`curr_\${grade}_\${subject}\`.replace(/\\s+/g, '_');
    const doc = {
       id: docId,
       name: \`\${grade} - \${subject} Curriculum\`,
       uploadDate: new Date().toISOString(),
       chapters: [] as any[],
       isPublic: true
    };
    
    let chapterNumber = 1;
    let topicNumber = 1;
    const chaptersMap = new Map<string, any>();
    
    for (const row of rows) {
       if (!chaptersMap.has(row.title)) {
          chaptersMap.set(row.title, {
             id: \`chap_\${chapterNumber}\`,
             chapterNumber,
             title: row.title,
             summary: '',
             content: '',
             type: 'chapter',
             sortOrder: chapterNumber * 100,
             children: []
          });
          chapterNumber++;
          topicNumber = 1;
       }
       
       const chap = chaptersMap.get(row.title);
       
       let fullContent = row.content || '';
       
       if (row.images && Array.isArray(row.images) && row.images.length > 0) {
          fullContent += '\\n\\n### Related Images\\n<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">';
          row.images.forEach((img: any) => {
             fullContent += \`<img src="\${img.url}" alt="\${img.alt}" class="w-full rounded-lg shadow-sm" />\`;
          });
          fullContent += '</div>\\n';
       }
       
       if (row.videos && Array.isArray(row.videos) && row.videos.length > 0) {
          fullContent += '\\n\\n### Related Videos\\n';
          row.videos.forEach((vid: any) => {
             fullContent += \`- [\${vid.title}](https://www.youtube.com/watch?v=\${vid.video_id}) (Channel: \${vid.channel})\\n\`;
          });
       }
       
       if (row.questions && Array.isArray(row.questions) && row.questions.length > 0) {
          fullContent += '\\n\\n### Practice Questions\\n';
          row.questions.forEach((q: any, i: number) => {
             fullContent += \`**Q\${i+1}: \${q.question}**\\n\`;
             q.options.forEach((opt: string) => {
                fullContent += \`- \${opt}\\n\`;
             });
             fullContent += \`*Answer: \${q.answer}*\\n\\n\`;
          });
       }
       
       const topic = {
          id: \`topic_\${chap.id}_\${topicNumber}\`,
          chapterNumber: topicNumber,
          title: row.subtopic,
          summary: '',
          content: fullContent,
          type: 'topic',
          parentId: chap.id,
          sortOrder: chap.sortOrder + topicNumber
       };
       doc.chapters.push(topic);
       topicNumber++;
    }
    
    doc.chapters.push(...Array.from(chaptersMap.values()));
    
    // Sort all by sortOrder
    doc.chapters.sort((a, b) => a.sortOrder - b.sortOrder);
    
    res.json(doc);
  } catch(err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/curriculum/generate', authenticate, async (req: any, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Expected an array' });
    }

    const results = [];
    
    for (const item of items) {
      const { grade, subject, title, subtopic, generateQuestions } = item;
      
      try {
        // 1. Generate Content
        const contentPrompt = \`Write a clear, simple textbook explanation on \${subtopic} for \${grade} \${subject}. Keep 150-300 words, plain paragraphs, no markdown headings.\`;
        const generatedContent = await callLLM(contentPrompt);

        // 2. Fetch Images
        const keywordPrompt = \`You are an Educational Search Assistant. Based on the chapter title, key concepts, and a detailed content summary, generate a single, precise search keyword that can be used on a photo/diagram search engine to find a relevant educational image. Return ONLY a JSON object: {"keyword": "string"}

Chapter Title: \${subtopic}
Key Concepts: \${title}
Content Summary: \${generatedContent ? generatedContent.substring(0, 2000) : ''}\`;
        
        let searchQuery = subtopic;
        try {
          const raw = await callLLM(keywordPrompt, undefined, 'json_object');
          const parsed = JSON.parse(raw.replace(/^\\s*\`\`\`json/, '').replace(/\`\`\`\\s*$/, '').trim());
          if (parsed.keyword) searchQuery = parsed.keyword.trim();
        } catch(e) {
           console.error("DeepSeek query generation failed, using fallback query", e);
           const stopWords = new Set(["a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is", "it", "no", "not", "of", "on", "or", "such", "that", "the", "their", "then", "there", "these", "they", "this", "to", "was", "will", "with"]);
           let words = (generatedContent || "").toLowerCase().replace(/[^a-z0-9\\s]/g, '').split(/\\s+/).filter((w: string) => w.length > 2 && !stopWords.has(w));
           let wordCounts: Record<string, number> = {};
           words.forEach((w: string) => { wordCounts[w] = (wordCounts[w] || 0) + 1; });
           let topWords = Object.keys(wordCounts).sort((a, b) => wordCounts[b] - wordCounts[a]).slice(0, 3).join(' ');
           searchQuery = \`\${title} \${topWords}\`.substring(0, 50).trim();
        }
        
        if (!searchQuery) searchQuery = subtopic;
        
        const pexelsKey = process.env.IMAGE_SEARCH_API_KEY;
        const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
        let images: any[] = [];
        
        async function fetchImagesForQuery(query: string) {
          const imgs: any[] = [];
          if (pexelsKey) {
            try {
              const pexelsRes = await fetch(\`https://api.pexels.com/v1/search?query=\${encodeURIComponent(query)}&per_page=3\`, {
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
            } catch (err) {}
          }
          
          if (imgs.length === 0 && unsplashKey) {
            try {
              const unsplashRes = await fetch(\`https://api.unsplash.com/search/photos?query=\${encodeURIComponent(query)}&per_page=3\`, {
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
            } catch (err) {}
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
            } catch (err) {}
          }
          return imgs;
        }

        images = await fetchImagesForQuery(searchQuery);

        // Relevance check
        if (images.length > 0) {
           const combinedText = images.map(img => (img.alt || "").toLowerCase()).join(" ");
           const titleWords = title.toLowerCase().split(/\\s+/);
           const checkWords = [...titleWords].filter(w => w.length > 2);
           const isRelevant = checkWords.some(w => combinedText.includes(w));
           if (!isRelevant && checkWords.length > 0) {
              const broaderQuery = title.trim();
              const retryImages = await fetchImagesForQuery(broaderQuery);
              if (retryImages.length > 0) {
                 images = retryImages;
              }
           }
        }

        // 3. Fetch Videos
        const videoPrompt = \`You are an expert Educational Video Retrieval Engine.
Your task is to find the best educational YouTube videos for a specific chapter context.
Grade Level: \${grade}
Chapter Title: \${title}
Subject: \${subject}
Summary: \${generatedContent.substring(0, 1500)}

Generate 3 highly optimized YouTube search queries suitable for the specified class context.
Return ONLY valid JSON exactly matching this schema:
{
  "recommended_videos": [
    {
      "title": "string",
      "search_query_used": "string",
      "quality_score": number
    }
  ]
}\`;
        let videos: any[] = [];
        try {
          const rawVid = await callLLM(videoPrompt, undefined, 'json_object');
          const parsedVid = JSON.parse(rawVid.replace(/^\\s*\`\`\`json/, '').replace(/\`\`\`\\s*$/, '').trim());
          if (parsedVid.recommended_videos) {
            for (const vid of parsedVid.recommended_videos.slice(0, 3)) {
              try {
                const searchResult = await ytSearch(vid.search_query_used || vid.title);
                if (searchResult && searchResult.videos.length > 0) {
                  videos.push({
                    video_id: searchResult.videos[0].videoId,
                    title: searchResult.videos[0].title,
                    channel: searchResult.videos[0].author.name,
                    quality_score: vid.quality_score || 80
                  });
                }
              } catch(e) {}
            }
          }
        } catch(e) {}

        // 4. Generate Questions
        let questions: any[] = [];
        if (generateQuestions) {
          const qPrompt = \`Based on this content: \${generatedContent}\\n\\nGenerate 3 multiple-choice questions for \${grade} \${subject}. Return JSON exactly matching this array schema: [{"question":"...","options":["A","B","C","D"],"answer":"A"}]\`;
          try {
            const rawQ = await callLLM(qPrompt, undefined, 'json_object');
            const parsedQ = JSON.parse(rawQ.replace(/^\\s*\`\`\`json/, '').replace(/\`\`\`\\s*$/, '').trim());
            questions = Array.isArray(parsedQ) ? parsedQ : (parsedQ.questions || []);
          } catch(e) {}
        }

        // 5. Insert into DB
        await sql\`
          INSERT INTO curriculum_library (grade, subject, title, subtopic, content, images, videos, questions)
          VALUES (\${grade}, \${subject}, \${title}, \${subtopic}, \${generatedContent}, \${JSON.stringify(images)}, \${JSON.stringify(videos)}, \${JSON.stringify(questions)})
        \`;

        results.push({ subtopic, status: "success" });
        
      } catch(err: any) {
        console.error(\`Error generating curriculum for \${subtopic}:\`, err);
        results.push({ subtopic, status: "error", error: err.message });
      }
    }
    
    res.json(results);
  } catch(err: any) {
    console.error("Error in /api/curriculum/generate:", err);
    res.status(500).json({ error: err.message });
  }
});

`;

content = content.substring(0, insertPoint) + curriculumRoutes + content.substring(insertPoint);
fs.writeFileSync('server.ts', content);
console.log("Fixed server.ts routes");
