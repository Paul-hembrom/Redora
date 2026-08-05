const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

const oldTicketCode = `  // --- Step 1: ticket (small JSON, safe through Vercel) ---
  onProgress('Preparing upload…');
  const ticketRes = await fetch('/api/documents/process-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name }),
  });`;

const newTicketCode = `  // --- Step 1: ticket (small JSON, safe through Vercel) ---
  onProgress('Hashing document...');
  const contentHash = await hashFile(file);
  onProgress('Preparing upload…');
  const ticketRes = await fetch('/api/documents/process-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentHash }),
  });`;

code = code.replace(oldTicketCode, newTicketCode);
fs.writeFileSync('src/lib/documentProcessor.ts', code);
