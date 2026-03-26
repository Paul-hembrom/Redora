import app from '../dist/server.js';

console.log('API handler loaded');

export default async function handler(req, res) {
  console.log(`Request received: ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  try {
    await app(req, res);
  } catch (err) {
    console.error('Error in handler:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}