const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `app.post('/api/documents/process', authenticate, uploadDoc.single('file'), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing file' });

    const form = new FormData();`;

const replacement = `app.post('/api/documents/process', authenticate, uploadDoc.single('file'), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing file' });
    if (!process.env.INTERNAL_API_KEY || !process.env.HF_SPACE_URL) {
      return res.status(500).json({ error: 'Document processor is not configured' });
    }

    const form = new FormData();`;

content = content.replace(targetStr, replacement);
fs.writeFileSync('server.ts', content);
console.log("Fixed server.ts");
