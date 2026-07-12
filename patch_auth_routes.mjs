import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const authRoutes = `
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
`;

if (!code.includes('/api/auth/login')) {
  // Insert before the error handling or at the end before app.listen
  const insertIndex = code.indexOf('app.listen(');
  if (insertIndex > -1) {
    code = code.substring(0, insertIndex) + authRoutes + "\n" + code.substring(insertIndex);
  } else {
    code += authRoutes;
  }
  fs.writeFileSync('server.ts', code);
  console.log('Added auth routes to server.ts');
}
