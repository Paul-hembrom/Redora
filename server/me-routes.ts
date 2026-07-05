import express from 'express';
import jwt from 'jsonwebtoken';
import sql from './db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'fallback-secret';

const authenticate = async (req: any, res: any, next: any) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.get('/context', authenticate, async (req: any, res: any) => {
  try {
    res.json({ role: 'admin' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
