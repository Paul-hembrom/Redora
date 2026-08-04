const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Ensure multer is imported
if (!code.includes("import multer")) {
    code = "import multer from 'multer';\n" + code;
}

const proxyRoute = `
const uploadDoc = multer({ limits: { fileSize: 100 * 1024 * 1024 } });

app.post('/api/documents/process', authenticate, uploadDoc.single('file'), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing file' });

    const form = new FormData();
    form.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);

    const r = await fetch(\`\${process.env.HF_SPACE_URL}/process\`, {
      method: 'POST',
      headers: { 'X-Internal-Key': process.env.INTERNAL_API_KEY as string },
      body: form as any,
    });

    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: text });
    return res.type('application/json').send(text);
  } catch (err: any) {
    console.error('[process proxy] failed:', err);
    res.status(502).json({ error: err.message });
  }
});
`;

if (!code.includes("app.post('/api/documents/process'")) {
    code = code.replace("app.post('/api/documents'", proxyRoute + "\napp.post('/api/documents'");
    fs.writeFileSync('server.ts', code);
}
