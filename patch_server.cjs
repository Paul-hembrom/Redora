const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
const target = "app.post('/api/auth/signup', async (req, res) => {";
const replacement = `app.post('/api/log-client-error', express.json(), (req, res) => {
  const { message, stack, source } = req.body;
  console.error(\`[Client Error] \${source || 'Unknown Source'}:\`, message);
  if (stack) {
    console.error(stack);
  }
  res.status(200).json({ status: 'logged' });
});

app.post('/api/auth/signup', async (req, res) => {`;
code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
