import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import sql from './server/db.js';
import { createInteractiveLesson } from './server/lessonOrchestrator.js';
import { saveSessionMemory } from './server/studentMemory.js';

import jwt from 'jsonwebtoken';
import ytSearch from 'yt-search';
import { callLLM } from './src/lib/gemini.js';


export const app = express();
const PORT = 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';
const authenticate = async (req: any, res: any, next: any) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.log('Authenticate: No token found in cookies or headers');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  let validUserId = null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    validUserId = decoded.userId || decoded.sub;
  } catch (err) {
    try {
      if (process.env.SUPABASE_JWT_SECRET) {
        const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET, { algorithms: ['HS256'] }) as any;
        validUserId = decoded.sub || decoded.userId;
      } else {
        throw new Error('Invalid token');
      }
    } catch (err2: any) {
      console.log('Authenticate error:', err2.message);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  
  if (validUserId) {
    req.user = { id: validUserId };
    next();
  } else {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};


app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

app.all(['/auth/token-exchange', '/api/auth/token-exchange'], (req, res) => {
  const token = req.query.token as string;
  const role = req.query.role as string;
  const org_id = req.query.org_id as string;
  const redirect = req.query.redirect as string;

  if (token) {
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    };
    
    res.cookie('token', token, cookieOptions);
    if (role) res.cookie('sb-role', role, cookieOptions);
    if (org_id) res.cookie('sb-org-id', org_id, cookieOptions);
  }

  let redirectUrl = redirect ? decodeURIComponent(redirect) : '/';
  // Force production domain if staging domain is passed
  if (redirectUrl.includes('d1.alphanexoraai.com')) {
    redirectUrl = redirectUrl.replace('d1.alphanexoraai.com', 'redora.alphanexoraai.com');
  }
  // Ensure the token exchange itself uses the correct domain base if absolute
  if (redirectUrl.startsWith('http') && !redirectUrl.includes('redora.alphanexoraai.com') && !redirectUrl.includes('localhost')) {
     try {
       const url = new URL(redirectUrl);
       url.hostname = 'redora.alphanexoraai.com';
       redirectUrl = url.toString();
     } catch (e) {}
  }
  res.redirect(redirectUrl);
});


// TTS Route
app.post('/api/tts/elevenlabs', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing ElevenLabs API key' });

    // Server-side sentence splitter
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    const chunks = [];
    for (const [index, sentence] of sentences.entries()) {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/JwEIvMzFlLwrArLvqeM5?output_format=mp3_22050_32`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: sentence.trim(),
          model_id: 'eleven_flash_v2_5'
        }),
      });
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        chunks.push({
          id: index,
          text: sentence.trim(),
          audioUrl: `data:audio/mp3;base64,${base64}`
        });
      }
    }
    res.json({ chunks });
  } catch(e) {
    console.error('TTS error', e);
    res.status(500).json({ error: e.message });
  }
});

// Chats
app.post('/api/chats', async (req, res) => {
  try {
    const { id, role, text, chapterId } = req.body;
    await sql`INSERT INTO chats (id, chapter_id, user_id, role, text) VALUES (${id}, ${chapterId}, 'default', ${role}, ${text})`;
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Memory
app.post('/api/topics/:topicId/memory', async (req, res) => {
  try {
    await saveSessionMemory('default', req.params.topicId, req.body.chatHistory);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Start Lesson
app.post('/api/topics/:topicId/start-lesson', async (req, res) => {
  try {
    const steps = await createInteractiveLesson(req.params.topicId, 'default', 'default');
    res.json({ steps });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Curriculum routes
app.get('/api/curriculum', async (req, res) => {
  try {
    const { grade, subject } = req.query;
    if (!grade || !subject) return res.status(400).json({ error: 'grade and subject required' });
    const gradeStr = typeof grade === 'string' ? grade : String(grade);
    const subjectStr = typeof subject === 'string' ? subject : String(subject);
    const rows = await sql`SELECT * FROM curriculum_library WHERE grade = ${gradeStr} AND subject = ${subjectStr} ORDER BY title, subtopic`;
    if (rows.length === 0) return res.json(null);
    const docId = `curr_${grade}_${subject}`.replace(/\s+/g, '_');
    const doc = { id: docId, name: `${grade} - ${subject} Curriculum`, uploadDate: new Date().toISOString(), chapters: [] };
    let chapterNumber = 1, topicNumber = 1;
    const chaptersMap = new Map();
    for (const row of rows) {
       if (!chaptersMap.has(row.title)) {
          chaptersMap.set(row.title, { id: `chap_${chapterNumber}`, chapterNumber, title: row.title, summary: '', content: '', type: 'chapter', sortOrder: chapterNumber * 100, children: [] });
          chapterNumber++;
          topicNumber = 1;
       }
       const chap = chaptersMap.get(row.title);
       let fullContent = row.content || '';
       
       if (row.images && Array.isArray(row.images) && row.images.length > 0) {
          fullContent += '\n\n### Related Images\n<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">';
          row.images.forEach((img) => { fullContent += `<img src="${img.url}" alt="${img.alt}" class="w-full rounded-lg shadow-sm" />`; });
          fullContent += '</div>\n';
       }
       if (row.videos && Array.isArray(row.videos) && row.videos.length > 0) {
          fullContent += '\n\n### Related Videos\n';
          row.videos.forEach((vid) => { fullContent += `- [${vid.title}](https://www.youtube.com/watch?v=${vid.video_id})\n`; });
       }
       const topic = { id: `topic_${chap.id}_${topicNumber}`, chapterNumber: topicNumber, title: row.subtopic, summary: '', content: fullContent, type: 'topic', parentId: chap.id, sortOrder: chap.sortOrder + topicNumber };
       doc.chapters.push(topic);
       topicNumber++;
    }
    doc.chapters.push(...Array.from(chaptersMap.values()));
    doc.chapters.sort((a, b) => a.sortOrder - b.sortOrder);
    res.json(doc);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});


// Document routes
app.get('/api/documents', async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM documents ORDER BY upload_date DESC`;
    for (const row of rows) {
      if (!row.images) row.images = [];
      if (typeof row.tags === 'string') {
        try { row.tags = JSON.parse(row.tags); } catch(e) { row.tags = []; }
      }
    }
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/documents/:id', async (req, res) => {
  try {
    const docRows = await sql`SELECT * FROM documents WHERE id = ${req.params.id}`;
    if (docRows.length === 0) return res.status(404).json({ error: 'Not found' });
    const doc = docRows[0];
    if (!doc.images) doc.images = [];
    if (typeof doc.tags === 'string') {
      try { doc.tags = JSON.parse(doc.tags); } catch(e) { doc.tags = []; }
    }
    
    const chapters = await sql`SELECT * FROM chapters WHERE document_id = ${doc.id} ORDER BY sort_order`;
    doc.chapters = chapters;
    res.json(doc);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/documents/:id', async (req, res) => {
  try {
    await sql`DELETE FROM documents WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/documents/:id/tags', async (req, res) => {
  try {
    await sql`UPDATE documents SET tags = ${JSON.stringify(req.body.tags)} WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/curriculum/generate', (req, res) => { res.status(401).json({ error: 'Missing access_token' }); });
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
        const contentPrompt = `Write a clear, simple textbook explanation on ${subtopic} for ${grade} ${subject}. Keep 150-300 words, plain paragraphs, no markdown headings.`;
        const generatedContent = await callLLM(contentPrompt);

        // 2. Fetch Images
        const keywordPrompt = `You are an Educational Search Assistant. Based on the chapter title, key concepts, and a detailed content summary, generate a single, precise search keyword that can be used on a photo/diagram search engine to find a relevant educational image. Return ONLY a JSON object: {"keyword": "string"}

Chapter Title: ${subtopic}
Key Concepts: ${title}
Content Summary: ${generatedContent ? generatedContent.substring(0, 2000) : ''}`;
        
        let searchQuery = subtopic;
        try {
          const raw = await callLLM(keywordPrompt, undefined, 'json_object');
          const parsed = JSON.parse(raw.replace(/^\\s*```json/, '').replace(/```\\s*$/, '').trim());
          if (parsed.keyword) searchQuery = parsed.keyword.trim();
        } catch(e) {
           console.error("DeepSeek query generation failed, using fallback query", e);
           const stopWords = new Set(["a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is", "it", "no", "not", "of", "on", "or", "such", "that", "the", "their", "then", "there", "these", "they", "this", "to", "was", "will", "with"]);
           let words = (generatedContent || "").toLowerCase().replace(/[^a-z0-9\\s]/g, '').split(/\\s+/).filter((w: string) => w.length > 2 && !stopWords.has(w));
           let wordCounts: Record<string, number> = {};
           words.forEach((w: string) => { wordCounts[w] = (wordCounts[w] || 0) + 1; });
           let topWords = Object.keys(wordCounts).sort((a, b) => wordCounts[b] - wordCounts[a]).slice(0, 3).join(' ');
           searchQuery = `${title} ${topWords}`.substring(0, 50).trim();
        }
        
        if (!searchQuery) searchQuery = subtopic;
        
        const pexelsKey = process.env.IMAGE_SEARCH_API_KEY;
        const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
        let images: any[] = [];
        
        async function fetchImagesForQuery(query: string) {
          const imgs: any[] = [];
          if (pexelsKey) {
            try {
              const pexelsRes = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3`, {
                headers: { Authorization: pexelsKey }
              });
              if (pexelsRes.ok) {
                const data = await pexelsRes.json();
                if (data.photos && data.photos.length > 0) {
                  for (const photo of data.photos) {
                    imgs.push({
                      url: photo.src.large || photo.src.original,
                      thumbnail: photo.src.medium,
                      alt: photo.alt || `Image for ${query}`,
                      source: "pexels"
                    });
                  }
                }
              }
            } catch (err) {}
          }
          
          if (imgs.length === 0 && unsplashKey) {
            try {
              const unsplashRes = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3`, {
                headers: { Authorization: `Client-ID ${unsplashKey}` }
              });
              if (unsplashRes.ok) {
                const data = await unsplashRes.json();
                if (data.results && data.results.length > 0) {
                  for (const photo of data.results) {
                    imgs.push({
                      url: photo.urls.regular || photo.urls.full,
                      thumbnail: photo.urls.small,
                      alt: photo.alt_description || `Image for ${query}`,
                      source: "unsplash"
                    });
                  }
                }
              }
            } catch (err) {}
          }

          if (imgs.length === 0) {
            try {
              const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query + " diagram")}&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&origin=*`;
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
        const videoPrompt = `You are an expert Educational Video Retrieval Engine.
Your task is to find the best educational YouTube videos for a specific chapter context.
Grade Level: ${grade}
Chapter Title: ${title}
Subject: ${subject}
Summary: ${generatedContent.substring(0, 1500)}

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
}`;
        let videos: any[] = [];
        try {
          const rawVid = await callLLM(videoPrompt, undefined, 'json_object');
          const parsedVid = JSON.parse(rawVid.replace(/^\\s*```json/, '').replace(/```\\s*$/, '').trim());
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
          const qPrompt = `Based on this content: ${generatedContent}\n\nGenerate 3 multiple-choice questions for ${grade} ${subject}. Return JSON exactly matching this array schema: [{"question":"...","options":["A","B","C","D"],"answer":"A"}]`;
          try {
            const rawQ = await callLLM(qPrompt, undefined, 'json_object');
            const parsedQ = JSON.parse(rawQ.replace(/^\\s*```json/, '').replace(/```\\s*$/, '').trim());
            questions = Array.isArray(parsedQ) ? parsedQ : (parsedQ.questions || []);
          } catch(e) {}
        }

        // 5. Insert into DB
        await sql`
          INSERT INTO curriculum_library (grade, subject, title, subtopic, content, images, videos, questions)
          VALUES (${grade}, ${subject}, ${title}, ${subtopic}, ${generatedContent}, ${JSON.stringify(images)}, ${JSON.stringify(videos)}, ${JSON.stringify(questions)})
        `;

        results.push({ subtopic, status: "success" });
        
      } catch(err: any) {
        console.error(`Error generating curriculum for ${subtopic}:`, err);
        results.push({ subtopic, status: "error", error: err.message });
      }
    }
    
    res.json(results);
  } catch(err: any) {
    console.error("Error in /api/curriculum/generate:", err);
    res.status(500).json({ error: err.message });
  }
});


// Vite middleware

// Avoid top-level await and dynamic import Vite to avoid bloating production builds
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  import('vite').then(({ createServer: createViteServer }) => {
    createViteServer({ server: { middlewareMode: true }, appType: 'spa' }).then(vite => {
      app.use(vite.middlewares);
    });
  }).catch(err => console.error('Failed to start Vite middleware:', err));
}
 else {
  // production fallback omitted for brevity
}

// --- Auth Routes ---
app.post('/api/auth/signup', (req, res) => {
  res.json({ success: true, message: 'Signup implemented natively on frontend or token-exchange' });
});

app.post('/api/auth/login', (req, res) => {
  res.json({ success: true, message: 'Login implemented natively on frontend or token-exchange' });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (token) {
     res.json({ user: { id: 'default' } });
  } else {
     res.status(401).json({ error: 'Unauthorized' });
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

console.log('=== REGISTERED ROUTES ===');
app._router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(Object.keys(r.route.methods).join(', ').toUpperCase() + ' ' + r.route.path);
  }
});
console.log('=========================');

export default app;
