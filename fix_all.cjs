const fs = require('fs');

// 1. Fix server.ts
let serverContent = fs.readFileSync('server.ts', 'utf-8');

const oldTicketRoute = `app.post('/api/documents/process-ticket', authenticate, async (req: any, res) => {
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

const newTicketRoute = `app.post('/api/documents/process-ticket', authenticate, async (req: any, res) => {
  try {
    // --- Resolve config, matching the naming already used elsewhere in this file ---
    const SUPABASE_URL_ENV =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY_ENV =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_SERVICE_KEY;
    const SPACE_URL_ENV =
      process.env.HF_SPACE_URL || process.env.VITE_HF_SPACE_URL;

    // --- Fail loudly and specifically, so the client can report which one ---
    const missing: string[] = [];
    if (!process.env.INTERNAL_API_KEY) missing.push('INTERNAL_API_KEY');
    if (!SUPABASE_URL_ENV) missing.push('SUPABASE_URL');
    if (!SUPABASE_KEY_ENV) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!SPACE_URL_ENV) missing.push('HF_SPACE_URL');
    if (missing.length) {
      console.error('[process-ticket] Missing env vars:', missing.join(', '));
      return res.status(500).json({
        error: \`Document processor not configured. Missing: \${missing.join(', ')}\`,
      });
    }

    const { filename } = req.body || {};
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'filename is required' });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    const objectPath = \`uploads/\${req.userId}/\${uuidv4()}_\${safeName}\`;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL_ENV!, SUPABASE_KEY_ENV!);

    const { data: signed, error: signErr } = await supabase
      .storage.from('assets')
      .createSignedUploadUrl(objectPath);

    if (signErr || !signed) {
      console.error('[process-ticket] createSignedUploadUrl failed:', signErr);
      return res.status(500).json({
        error: \`Could not create upload URL: \${signErr?.message || 'unknown'}\`,
      });
    }

    // HMAC token, valid 10 minutes, verified by the Space.
    const exp = Math.floor(Date.now() / 1000) + 600;
    const sig = crypto
      .createHmac('sha256', process.env.INTERNAL_API_KEY!)
      .update(String(exp))
      .digest('hex');

    const { data: pub } = supabase.storage.from('assets').getPublicUrl(objectPath);

    // Strip any trailing slash so \`\${spaceUrl}/process-url\` can't become \`//process-url\`
    const spaceUrl = SPACE_URL_ENV!.replace(/\\/+$/, '');

    console.log(\`[process-ticket] Issued ticket for \${objectPath} -> \${spaceUrl}\`);

    res.json({
      uploadUrl: signed.signedUrl,
      objectPath,
      fileUrl: pub.publicUrl,
      processToken: \`\${exp}.\${sig}\`,
      spaceUrl,
    });
  } catch (err: any) {
    console.error('[process-ticket] failed:', err);
    res.status(500).json({ error: err.message });
  }
});`;

serverContent = serverContent.replace(oldTicketRoute, newTicketRoute);
fs.writeFileSync('server.ts', serverContent);
console.log("Fixed server.ts");


// 2. Fix documentProcessor.ts
let docContent = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

const oldProcessWrapper = `export async function processDocument(
  file: File,
  options: PreprocessOptions,
  onProgress: (msg: string) => void,
  callbacks?: {
    onDiscovered?: (chapters: Chapter[]) => void;
    onChapterDone?: (id: string, title: string, summary: string) => void;
  },
): Promise<Chapter[]> {
  try {
    return await processDocumentViaSpace(file, options, onProgress, callbacks);
  } catch (error) {
    console.warn('HF Space processing failed, falling back to local pipeline:', error);
    onProgress('AI service unavailable, processing locally…');
    return await processDocumentLocal(file, options, onProgress, callbacks);
  }
}`;

const newProcessWrapper = `export async function processDocument(
  file: File,
  options: PreprocessOptions,
  onProgress: (msg: string) => void,
  callbacks?: {
    onDiscovered?: (chapters: Chapter[]) => void;
    onChapterDone?: (id: string, title: string, summary: string) => void;
  },
): Promise<Chapter[]> {
  try {
    return await processDocumentViaSpace(file, options, onProgress, callbacks);
  } catch (error: any) {
    console.error('[documentProcessor] SPACE PIPELINE FAILED — falling back to local.', {
      message: error?.message,
      stack: error?.stack,
      error,
    });
    onProgress(\`AI processor unavailable (\${error?.message || 'unknown error'}) — processing locally…\`);
    return await processDocumentLocal(file, options, onProgress, callbacks);
  }
}`;

docContent = docContent.replace(oldProcessWrapper, newProcessWrapper);

const newViaSpace = `async function processDocumentViaSpace(
  file: File,
  options: PreprocessOptions,
  onProgress: (msg: string) => void,
  callbacks?: {
    onDiscovered?: (chapters: Chapter[]) => void;
    onChapterDone?: (id: string, title: string, summary: string) => void;
  },
): Promise<Chapter[]> {

  // --- Step 1: ticket (small JSON, safe through Vercel) ---
  onProgress('Preparing upload…');
  const ticketRes = await fetch('/api/documents/process-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name }),
  });

  if (!ticketRes.ok) {
    const t = await ticketRes.text().catch(() => '');
    throw new Error(\`process-ticket failed (\${ticketRes.status}): \${t.slice(0, 300)}\`);
  }
  const ticket = await ticketRes.json();

  // Explicit guards: without these a missing field silently produces a request
  // to "undefined/process-url", which resolves against our OWN origin and 404s
  // on Vercel — so the Space never sees anything and the cause is invisible.
  if (!ticket.uploadUrl) throw new Error('Ticket missing uploadUrl');
  if (!ticket.fileUrl) throw new Error('Ticket missing fileUrl');
  if (!ticket.processToken) throw new Error('Ticket missing processToken');
  if (!ticket.spaceUrl || !/^https?:\\/\\//i.test(ticket.spaceUrl)) {
    throw new Error(\`Ticket returned invalid spaceUrl: \${ticket.spaceUrl} (is HF_SPACE_URL set on Vercel?)\`);
  }

  // --- Step 2: upload straight to Supabase via the signed URL ---
  // Plain PUT: no supabase-js in the browser, no anon key needed.
  onProgress(\`Uploading \${(file.size / 1024 / 1024).toFixed(1)} MB…\`);
  const putRes = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/pdf' },
    body: file,
  });
  if (!putRes.ok) {
    const t = await putRes.text().catch(() => '');
    throw new Error(\`Supabase upload failed (\${putRes.status}): \${t.slice(0, 300)}\`);
  }
  console.log('[documentProcessor] Uploaded to', ticket.objectPath);

  // --- Step 3: ask the Space to process it (direct; no Vercel timeout) ---
  onProgress('Processing document with Docling… this can take several minutes.');
  console.log('[documentProcessor] Calling', \`\${ticket.spaceUrl}/process-url\`);

  const response = await fetch(\`\${ticket.spaceUrl}/process-url\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_url: ticket.fileUrl, token: ticket.processToken }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(\`Space /process-url failed (\${response.status}): \${errText.slice(0, 500)}\`);
  }

  onProgress('Receiving structured content…');
  const chapters: Chapter[] = await response.json();

  // --- Guard: never accept an empty/thin structure (Phase 3.7) ---
  if (!Array.isArray(chapters) || chapters.length === 0) {
    throw new Error('Processor returned no chapters — falling back to local extraction');
  }
  const totalContentChars = chapters.reduce((sum, ch) => {
    const childChars = (ch.children || []).reduce((s, c) => s + (c.content?.length || 0), 0);
    return sum + (ch.content?.length || 0) + childChars;
  }, 0);
  if (totalContentChars < 500) {
    throw new Error(
      \`Processor returned \${chapters.length} chapters but only \${totalContentChars} chars — falling back\`
    );
  }
  console.log(\`[documentProcessor] Space returned \${chapters.length} chapters, \${totalContentChars} chars.\`);

  callbacks?.onDiscovered?.(chapters);
  if (callbacks?.onChapterDone) {
    chapters.forEach((ch: Chapter) =>
      callbacks.onChapterDone && callbacks.onChapterDone(ch.id, ch.title, ch.summary || '')
    );
  }

  onProgress('Done.');
  return chapters;
}`;

const startViaSpace = "async function processDocumentViaSpace(";
const endViaSpace = "export async function processDocument(";
const startIdx = docContent.indexOf(startViaSpace);
const endIdx = docContent.indexOf(endViaSpace);

if (startIdx !== -1 && endIdx !== -1) {
  docContent = docContent.substring(0, startIdx) + newViaSpace + "\n\n" + docContent.substring(endIdx);
  fs.writeFileSync('src/lib/documentProcessor.ts', docContent);
  console.log("Fixed documentProcessor.ts");
} else {
  console.error("Could not find processDocumentViaSpace to replace.");
}

