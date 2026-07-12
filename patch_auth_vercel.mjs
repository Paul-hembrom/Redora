import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const badBlock = `if (!process.env.VERCEL) {
  // --- Auth Routes ---
app.post('/api/auth/signup', (req, res) => {
  res.json({ success: true, message: 'Signup implemented natively on frontend or token-exchange' });
});

app.post('/api/auth/login', (req, res) => {
  res.json({ success: true, message: 'Login implemented natively on frontend or token-exchange' });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (token) {
     res.json({ user: { id: 'default' } });
  } else {
     res.status(401).json({ error: 'Unauthorized' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Server running on http://0.0.0.0:\${PORT}\`);
  });
}`;

const goodBlock = `// --- Auth Routes ---
app.post('/api/auth/signup', (req, res) => {
  res.json({ success: true, message: 'Signup implemented natively on frontend or token-exchange' });
});

app.post('/api/auth/login', (req, res) => {
  res.json({ success: true, message: 'Login implemented natively on frontend or token-exchange' });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (token) {
     res.json({ user: { id: 'default' } });
  } else {
     res.status(401).json({ error: 'Unauthorized' });
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Server running on http://0.0.0.0:\${PORT}\`);
  });
}`;

if (code.includes('if (!process.env.VERCEL) {\n  // --- Auth Routes ---')) {
    code = code.replace(badBlock, goodBlock);
    fs.writeFileSync('server.ts', code);
    console.log("Patched server.ts to move auth routes outside VERCEL check!");
} else {
    console.log("Could not find the exact bad block.");
}
