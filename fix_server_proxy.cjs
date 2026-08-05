const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const oldRoute = `const uploadDoc = multer({ limits: { fileSize: 100 * 1024 * 1024 } });

app.post('/api/documents/process', authenticate, uploadDoc.single('file'), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing file' });
    if (!process.env.INTERNAL_API_KEY || !process.env.HF_SPACE_URL) {
      return res.status(500).json({ error: 'Document processor is not configured' });
    }

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
});`;

const newRoute = `import crypto from 'crypto';

app.post('/api/documents/process-ticket', authenticate, async (req: any, res) => {
  try {
    if (!process.env.INTERNAL_API_KEY) {
      return res.status(500).json({ error: 'INTERNAL_API_KEY not configured' });
    }

    const { filename } = req.body || {};
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'filename is required' });
    }

    // Namespace by user so one user cannot overwrite another's upload.
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    const objectPath = \`uploads/\${req.userId}/\${uuidv4()}_\${safeName}\`;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
    );

    // Signed upload URL: lets the browser PUT directly to Supabase without
    // ever seeing the service role key.
    const { data: signed, error: signErr } = await supabase
      .storage.from('assets')
      .createSignedUploadUrl(objectPath);

    if (signErr) {
      console.error('[process-ticket] signed upload URL failed:', signErr);
      return res.status(500).json({ error: signErr.message });
    }

    // HMAC token, valid 10 minutes, verified by the Space.
    const exp = Math.floor(Date.now() / 1000) + 600;
    const sig = crypto
      .createHmac('sha256', process.env.INTERNAL_API_KEY)
      .update(String(exp))
      .digest('hex');

    const { data: pub } = supabase.storage.from('assets').getPublicUrl(objectPath);

    res.json({
      uploadUrl: signed.signedUrl,
      uploadToken: signed.token,
      objectPath,
      fileUrl: pub.publicUrl,
      processToken: \`\${exp}.\${sig}\`,
      spaceUrl: process.env.HF_SPACE_URL,
    });
  } catch (err: any) {
    console.error('[process-ticket] failed:', err);
    res.status(500).json({ error: err.message });
  }
});`;

if(content.includes('import crypto from ')) {
  content = content.replace(oldRoute, newRoute.replace("import crypto from 'crypto';\n\n", ""));
} else {
  content = content.replace(oldRoute, newRoute);
}

fs.writeFileSync('server.ts', content);
console.log("Replaced route");
