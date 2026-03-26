import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from './server/db';

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
app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) return res.status(400).json({ error: 'Email already in use' });

    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)').run(id, name, email, hash);

    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ user: { id, name, email } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
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

app.get('/api/auth/me', authenticate, (req: any, res) => {
  try {
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.userId);
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
app.get('/api/documents', authenticate, (req: any, res) => {
  try {
    const docs = db.prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY upload_date DESC').all(req.userId) as any[];
    const result = docs.map(doc => {
      const chapters = db.prepare('SELECT * FROM chapters WHERE document_id = ? ORDER BY chapter_number ASC').all(doc.id) as any[];
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

app.post('/api/documents', authenticate, (req: any, res) => {
  const { id, name, chapters } = req.body;
  try {
    db.transaction(() => {
      db.prepare('INSERT INTO documents (id, user_id, name) VALUES (?, ?, ?)').run(id, req.userId, name);
      const insertChapter = db.prepare('INSERT INTO chapters (id, document_id, chapter_number, title, summary, content) VALUES (?, ?, ?, ?, ?, ?)');
      for (const ch of chapters) {
        insertChapter.run(ch.id, id, ch.chapterNumber, ch.title, ch.summary, ch.content);
      }
    })();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Chat Routes ---
app.get('/api/chats/:chapterId', authenticate, (req: any, res) => {
  try {
    const chats = db.prepare('SELECT * FROM chats WHERE chapter_id = ? AND user_id = ? ORDER BY created_at ASC').all(req.params.chapterId, req.userId) as any[];
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

app.post('/api/chats', authenticate, (req: any, res) => {
  const { id, chapterId, role, text, relationshipGraph, followUps } = req.body;
  try {
    db.prepare('INSERT INTO chats (id, chapter_id, user_id, role, text, relationship_graph, follow_ups) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, chapterId, req.userId, role, text, relationshipGraph ? JSON.stringify(relationshipGraph) : null, followUps ? JSON.stringify(followUps) : null);
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
