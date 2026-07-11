import fs from 'fs';

let content = fs.readFileSync('server2.ts', 'utf-8');

const docRoutes = `
// Document routes
app.get('/api/documents', async (req, res) => {
  try {
    const rows = await sql\`SELECT * FROM documents ORDER BY upload_date DESC\`;
    for (const row of rows) {
      if (!row.images) row.images = [];
      if (typeof row.tags === 'string') {
        try { row.tags = JSON.parse(row.tags); } catch(e) { row.tags = []; }
      }
    }
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/documents/:id', async (req, res) => {
  try {
    const docRows = await sql\`SELECT * FROM documents WHERE id = \${req.params.id}\`;
    if (docRows.length === 0) return res.status(404).json({ error: 'Not found' });
    const doc = docRows[0];
    if (!doc.images) doc.images = [];
    if (typeof doc.tags === 'string') {
      try { doc.tags = JSON.parse(doc.tags); } catch(e) { doc.tags = []; }
    }
    
    const chapters = await sql\`SELECT * FROM chapters WHERE document_id = \${doc.id} ORDER BY sort_order\`;
    doc.chapters = chapters;
    res.json(doc);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/documents/:id', async (req, res) => {
  try {
    await sql\`DELETE FROM documents WHERE id = \${req.params.id}\`;
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/documents/:id/tags', async (req, res) => {
  try {
    await sql\`UPDATE documents SET tags = \${JSON.stringify(req.body.tags)} WHERE id = \${req.params.id}\`;
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
`;

content = content.replace(
  "// Vite middleware",
  docRoutes + "\n// Vite middleware"
);

fs.writeFileSync('server2.ts', content);
