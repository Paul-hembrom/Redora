const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newsEndpointRegex = /app\.post\('\/api\/search-news'[\s\S]*?res\.status\(500\)\.json\({ error: err\.message }\);\n  }\n}\);/;

const newEndpoint = `app.post('/api/search-news', authenticate, async (req: any, res) => {
  try {
    const { query, topicTitle, keyConcepts } = req.body;
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
      return res.json({ summary: "Failed to fetch news." });
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

    const topNews = news.slice(0, 5);
    
    if (topNews.length === 0) {
      return res.json({ summary: \`I couldn't find any recent news for "\${query}".\` });
    }

    const { callLLM } = await import('./src/lib/gemini.js');

    const snippetsText = topNews.map((n, i) => \`[\${i + 1}] Source: \${n.source}\\nTitle: \${n.title}\\nLink: \${n.link}\\nDate: \${n.date}\\nSnippet: \${n.snippet}\`).join('\\n\\n');

    const systemPrompt = \`You are a classroom news assistant. Given a topic and a set of recent news snippets, write a concise, engaging summary suitable for students. Embed source links naturally in the text using Markdown: [source name](URL). Do not add any information not present in the snippets. Keep the summary to 200-300 words.\`;

    const userPrompt = \`Topic Title: \${topicTitle || query}\\nKey Concepts: \${keyConcepts || 'N/A'}\\n\\nNews Snippets:\\n\${snippetsText}\\n\\nPlease generate the summary.\`;

    const summaryText = await callLLM(userPrompt, systemPrompt, "text", 1024, 0.7);

    res.json({ summary: summaryText });
  } catch (err: any) {
    console.error('Error in /api/search-news:', err);
    res.status(500).json({ error: err.message });
  }
});`;

code = code.replace(newsEndpointRegex, newEndpoint);
fs.writeFileSync('server.ts', code);
console.log("Updated /api/search-news in server.ts");
