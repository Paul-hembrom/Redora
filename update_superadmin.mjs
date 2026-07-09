import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `app.post('/api/curriculum/generate', authenticate, async (req: any, res) => {
  try {
    const items = req.body;`;

const replaceStr = `app.post('/api/curriculum/generate', authenticate, async (req: any, res) => {
  try {
    if (!process.env.SUPERADMIN_EMAIL) {
      console.warn('SUPERADMIN_EMAIL environment variable is not set.');
      return res.status(500).json({ error: 'Server misconfiguration: SUPERADMIN_EMAIL not set' });
    }

    const userRows = await sql\`SELECT email FROM users WHERE id = \${req.userId}\`;
    if (userRows.length === 0 || userRows[0].email !== process.env.SUPERADMIN_EMAIL) {
      return res.status(403).json({ error: 'Only the superadmin can generate curriculum content.' });
    }

    const items = req.body;`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replaceStr);
  fs.writeFileSync('server.ts', content);
  console.log("Superadmin check added successfully.");
} else {
  console.log("Could not find the target string to replace.");
}
