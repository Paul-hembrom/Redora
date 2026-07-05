import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from './db.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'fallback-secret';

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.json({ user: { id: user.id, name: user.name, email: user.email }, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const users = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (users.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await sql`INSERT INTO users (id, name, email, password_hash) VALUES (${id}, ${name}, ${email}, ${hash})`;
    
    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.json({ user: { id, name, email }, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const users = await sql`SELECT * FROM users WHERE id = ${decoded.userId}`;
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = users[0];
    res.json({ user: { id: user.id, name: user.name, email: user.email }, token });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

export default router;
