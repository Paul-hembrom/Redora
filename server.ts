import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from './lib/supabase.js'; // adjust the path if needed

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
    // Check if user already exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) return res.status(400).json({ error: 'Email already in use' });

    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);

    const { data: user, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({ id, name, email, password_hash: hash })
      .select()
      .single();

    if (insertError) throw insertError;

    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticate, async (req: any, res) => {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .eq('id', req.userId)
      .single();

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err: any) {
    console.error(err);
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
    // Fetch documents for the user
    const { data: docs, error: docsError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('user_id', req.userId)
      .order('upload_date', { ascending: false });

    if (docsError) throw docsError;

    // For each document, fetch its chapters
    const result = await Promise.all(
      (docs || []).map(async (doc) => {
        const { data: chapters, error: chaptersError } = await supabaseAdmin
          .from('chapters')
          .select('*')
          .eq('document_id', doc.id)
          .order('chapter_number', { ascending: true });

        if (chaptersError) throw chaptersError;

        return {
          id: doc.id,
          name: doc.name,
          uploadDate: doc.upload_date,
          chapters: (chapters || []).map((ch) => ({
            id: ch.id,
            chapterNumber: ch.chapter_number,
            title: ch.title,
            summary: ch.summary,
            content: ch.content,
          })),
        };
      })
    );

    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents', authenticate, async (req: any, res) => {
  const { id, name, chapters } = req.body;
  try {
    // Start a transaction by using a database function or multiple inserts.
    // Since Supabase doesn't have a built‑in transaction for multiple tables,
    // we'll insert the document first, then chapters. If something fails,
    // we'll delete the document to keep consistency (or use a database function).
    // For simplicity, we'll just insert and handle errors.

    // Insert the document
    const { error: docError } = await supabaseAdmin
      .from('documents')
      .insert({ id, user_id: req.userId, name });

    if (docError) throw docError;

    // Insert chapters in a batch
    const chaptersToInsert = chapters.map((ch: any) => ({
      id: ch.id,
      document_id: id,
      chapter_number: ch.chapterNumber,
      title: ch.title,
      summary: ch.summary,
      content: ch.content,
    }));

    const { error: chaptersError } = await supabaseAdmin
      .from('chapters')
      .insert(chaptersToInsert);

    if (chaptersError) {
      // If chapters insertion fails, delete the document to maintain consistency
      await supabaseAdmin.from('documents').delete().eq('id', id);
      throw chaptersError;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- Chat Routes ---
app.get('/api/chats/:chapterId', authenticate, async (req: any, res) => {
  try {
    const { data: chats, error } = await supabaseAdmin
      .from('chats')
      .select('*')
      .eq('chapter_id', req.params.chapterId)
      .eq('user_id', req.userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const result = (chats || []).map((c) => ({
      id: c.id,
      role: c.role,
      text: c.text,
      relationshipGraph: c.relationship_graph ? JSON.parse(c.relationship_graph) : undefined,
      followUps: c.follow_ups ? JSON.parse(c.follow_ups) : undefined,
    }));

    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chats', authenticate, async (req: any, res) => {
  const { id, chapterId, role, text, relationshipGraph, followUps } = req.body;
  try {
    const { error } = await supabaseAdmin.from('chats').insert({
      id,
      chapter_id: chapterId,
      user_id: req.userId,
      role,
      text,
      relationship_graph: relationshipGraph ? JSON.stringify(relationshipGraph) : null,
      follow_ups: followUps ? JSON.stringify(followUps) : null,
    });

    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- Server startup (same as before) ---
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