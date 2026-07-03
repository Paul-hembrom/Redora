const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `app.post('/api/documents', authenticate, async (req: any, res) => {
  const { id, name, chapters, tags, org_id } = req.body;`;

const replacement = `app.post('/api/documents', authenticate, async (req: any, res) => {
  try {
    const { processDocument } = await import('./src/lib/documentProcessor.js');
    // Using dynamic import as requested to isolate it from client bundle when SSR is involved.
  } catch (err) {
    console.error('Failed to load document processor:', err);
    // Ignore error and proceed as normal since we don't actually process it here.
  }
  const { id, name, chapters, tags, org_id } = req.body;`;

code = code.replace(target, replacement);

fs.writeFileSync('server.ts', code);
