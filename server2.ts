import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import sql from './server/db.js';
import { createInteractiveLesson } from './server/lessonOrchestrator.js';
import { saveSessionMemory } from './server/studentMemory.js';
import { createServer as createViteServer } from 'vite';

export const app = express();
const PORT = 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

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

// Vite middleware
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  // production fallback omitted for brevity
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
