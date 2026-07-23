const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newsEndpoint = `app.post('/api/search-news', authenticate, async (req: any, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'SERPER_API_KEY is not configured' });
    }

    const response = await fetch(\`https://google.serper.dev/news?q=\${encodeURIComponent(query)}&apiKey=\${apiKey}\`);
    if (!response.ok) {
      console.error('Serper News API error:', await response.text());
      return res.json([]);
    }

    const data = await response.json();
    const news = [];

    if (data.news && Array.isArray(data.news)) {
      for (const item of data.news) {
        news.push({
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          date: item.date,
          source: item.source
        });
      }
    }

    res.json(news.slice(0, 5));
  } catch (err: any) {
    console.error('Error in /api/search-news:', err);
    res.status(500).json({ error: err.message });
  }
});

`;

if (!code.includes('/api/search-news')) {
    code = code.replace("app.post('/api/search-images'", newsEndpoint + "app.post('/api/search-images'");
    fs.writeFileSync('server.ts', code);
    console.log("Added /api/search-news endpoint.");
} else {
    console.log("Endpoint already exists.");
}
