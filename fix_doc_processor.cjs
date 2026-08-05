const fs = require('fs');
let content = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

const targetStr = `async function processDocumentViaSpace(
  file: File,
  options: PreprocessOptions,
  onProgress: (msg: string) => void,
  callbacks?: {
    onDiscovered?: (chapters: Chapter[]) => void;
    onChapterDone?: (id: string, title: string, summary: string) => void;
  },
): Promise<Chapter[]> {
  const endpoint = '/api/documents/process';
  onProgress('Uploading document to AI processor…');

  const formData = new FormData();
  formData.append('file', file, file.name);

  const response = await fetch(endpoint, { method: 'POST', body: formData });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(\`Document processing failed (\${response.status}): \${errText}\`);
  }

  onProgress('Receiving structured content…');
  const chapters: Chapter[] = await response.json();

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

  callbacks?.onDiscovered?.(chapters);
  if (callbacks?.onChapterDone) {
    chapters.forEach((ch: Chapter) => callbacks.onChapterDone && callbacks.onChapterDone(ch.id, ch.title, ch.summary || ''));
  }

  onProgress('Done.');
  return chapters;
}`;

const newStr = `async function processDocumentViaSpace(
  file: File,
  options: PreprocessOptions,
  onProgress: (msg: string) => void,
  callbacks?: {
    onDiscovered?: (chapters: Chapter[]) => void;
    onChapterDone?: (id: string, title: string, summary: string) => void;
  },
): Promise<Chapter[]> {

  // --- Step 1: get an upload ticket (small JSON, safe through Vercel) ---
  onProgress('Preparing upload…');
  const ticketRes = await fetch('/api/documents/process-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name }),
  });
  if (!ticketRes.ok) {
    throw new Error(\`Could not start upload (\${ticketRes.status})\`);
  }
  const ticket = await ticketRes.json();

  // --- Step 2: upload the PDF straight to Supabase (bypasses Vercel entirely) ---
  onProgress('Uploading document…');
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  const { error: upErr } = await supabase
    .storage.from('assets')
    .uploadToSignedUrl(ticket.objectPath, ticket.uploadToken, file);

  if (upErr) {
    throw new Error(\`Upload failed: \${upErr.message}\`);
  }

  // --- Step 3: ask the Space to process it (direct; no Vercel timeout) ---
  onProgress('Processing document with Docling… this can take several minutes.');
  const response = await fetch(\`\${ticket.spaceUrl}/process-url\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_url: ticket.fileUrl, token: ticket.processToken }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(\`Document processing failed (\${response.status}): \${errText}\`);
  }

  onProgress('Receiving structured content…');
  const chapters: Chapter[] = await response.json();

  // --- Guard from Phase 3.7: never accept an empty/thin structure ---
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

content = content.replace(targetStr, newStr);

fs.writeFileSync('src/lib/documentProcessor.ts', content);
console.log("Replaced doc processor");
