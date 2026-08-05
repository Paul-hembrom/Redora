const fs = require('fs');
let content = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

const target = `  // --- Step 1: get an upload ticket (small JSON, safe through Vercel) ---
  onProgress('Preparing upload…');
  const ticketRes = await fetch('/api/documents/process-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name }),
  });`;

const replacement = `  // --- Step 1: get an upload ticket (small JSON, safe through Vercel) ---
  onProgress('Preparing upload…');
  
  const ticketPayload = { filename: file.name };
  console.log('[documentProcessor] Requesting ticket from /api/documents/process-ticket with payload:', ticketPayload);
  
  const ticketRes = await fetch('/api/documents/process-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticketPayload),
  });`;

content = content.replace(target, replacement);

const target2 = `  // --- Step 3: ask the Space to process it (direct; no Vercel timeout) ---
  onProgress('Processing document with Docling… this can take several minutes.');
  const response = await fetch(\`\${ticket.spaceUrl}/process-url\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_url: ticket.fileUrl, token: ticket.processToken }),
  });`;

const replacement2 = `  // --- Step 3: ask the Space to process it (direct; no Vercel timeout) ---
  onProgress('Processing document with Docling… this can take several minutes.');
  
  const hfPayload = { file_url: ticket.fileUrl, token: ticket.processToken };
  console.log(\`[documentProcessor] Fetching from HF Space at \${ticket.spaceUrl}/process-url\`);
  console.log('[documentProcessor] HF Space Payload:', hfPayload);
  
  const response = await fetch(\`\${ticket.spaceUrl}/process-url\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hfPayload),
  });`;

content = content.replace(target2, replacement2);
fs.writeFileSync('src/lib/documentProcessor.ts', content);
