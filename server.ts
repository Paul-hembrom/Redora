import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import sql from './server/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-me-in-prod';

export const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(cookieParser());

// --- Auth Middleware ---
const authenticate = (req: any, res: any, next: any) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- Auth Routes ---
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const existingUser = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existingUser.length > 0) return res.status(400).json({ error: 'Email already in use' });

    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);
    await sql`INSERT INTO users (id, name, email, password_hash) VALUES (${id}, ${name}, ${email}, ${hash})`;

    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ user: { id, name, email } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const users = await sql`SELECT * FROM users WHERE email = ${email}`;
    const user = users[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticate, async (req: any, res) => {
  try {
    const users = await sql`SELECT id, name, email FROM users WHERE id = ${req.userId}`;
    const user = users[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
  res.json({ success: true });
});

// --- Document Routes ---
app.get('/api/documents', authenticate, async (req: any, res) => {
  try {
    const docs = await sql`SELECT * FROM documents WHERE user_id = ${req.userId} ORDER BY upload_date DESC`;
    
    // Fetch all chapters for these documents
    const docIds = docs.map(d => d.id);
    let allChapters: any[] = [];
    if (docIds.length > 0) {
      allChapters = await sql`SELECT * FROM chapters WHERE document_id IN ${sql(docIds)} ORDER BY chapter_number ASC`;
    }

    const result = docs.map(doc => {
      const chapters = allChapters.filter(ch => ch.document_id === doc.id);
      return {
        id: doc.id,
        name: doc.name,
        uploadDate: doc.upload_date,
        chapters: chapters.map(ch => ({
          id: ch.id,
          chapterNumber: ch.chapter_number,
          title: ch.title,
          summary: ch.summary,
          content: ch.content
        }))
      };
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents', authenticate, async (req: any, res) => {
  const { id, name, chapters } = req.body;
  try {
    await sql.begin(async (sql) => {
      await sql`INSERT INTO documents (id, user_id, name) VALUES (${id}, ${req.userId}, ${name})`;
      
      if (chapters && chapters.length > 0) {
        const chaptersToInsert = chapters.map((ch: any) => ({
          id: ch.id,
          document_id: id,
          chapter_number: ch.chapterNumber,
          title: ch.title,
          summary: ch.summary,
          content: ch.content
        }));
        await sql`INSERT INTO chapters ${sql(chaptersToInsert)}`;
      }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/documents/:id', authenticate, async (req: any, res) => {
  try {
    const docId = req.params.id;
    // Verify ownership
    const docs = await sql`SELECT id FROM documents WHERE id = ${docId} AND user_id = ${req.userId}`;
    if (docs.length === 0) return res.status(404).json({ error: 'Document not found' });

    // With ON DELETE CASCADE in the schema, deleting the document will delete chapters and chats automatically.
    // However, to be safe and explicit (or if cascade isn't fully set up on existing DBs), we can delete manually:
    await sql.begin(async (sql) => {
      await sql`DELETE FROM chats WHERE chapter_id IN (SELECT id FROM chapters WHERE document_id = ${docId})`;
      await sql`DELETE FROM chapters WHERE document_id = ${docId}`;
      await sql`DELETE FROM documents WHERE id = ${docId}`;
    });
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Chat Routes ---
app.get('/api/chats/:chapterId', authenticate, async (req: any, res) => {
  try {
    const chats = await sql`SELECT * FROM chats WHERE chapter_id = ${req.params.chapterId} AND user_id = ${req.userId} ORDER BY created_at ASC`;
    const result = chats.map(c => ({
      id: c.id,
      role: c.role,
      text: c.text,
      relationshipGraph: c.relationship_graph ? JSON.parse(c.relationship_graph) : undefined,
      followUps: c.follow_ups ? JSON.parse(c.follow_ups) : undefined
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chats', authenticate, async (req: any, res) => {
  const { id, chapterId, role, text, relationshipGraph, followUps } = req.body;
  try {
    await sql`
      INSERT INTO chats (id, chapter_id, user_id, role, text, relationship_graph, follow_ups) 
      VALUES (
        ${id}, 
        ${chapterId}, 
        ${req.userId}, 
        ${role}, 
        ${text}, 
        ${relationshipGraph ? JSON.stringify(relationshipGraph) : null}, 
        ${followUps ? JSON.stringify(followUps) : null}
      )
    `;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
