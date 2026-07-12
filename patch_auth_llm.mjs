import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const imports = `
import jwt from 'jsonwebtoken';
import ytSearch from 'yt-search';
import { callLLM } from './src/lib/gemini.js';
`;

code = code.replace(/import { createServer as createViteServer } from 'vite';/, "import { createServer as createViteServer } from 'vite';" + imports);

const authBlock = `
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
`;

code = code.replace(/const PORT = 3000;/, "const PORT = 3000;\n" + authBlock);

fs.writeFileSync('server.ts', code);
console.log('Patched auth and imports!');
