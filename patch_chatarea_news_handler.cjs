const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const newsHandler = `  const handleFetchNews = async () => {
    if (isTyping) return;
    const currentChapterId = chapter.id;

    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', text: "Find news articles for this topic." };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setError(null);

    try {
      // 1. Generate query
      const { generateNewsSearchQuery } = await import('../lib/gemini');
      const query = await generateNewsSearchQuery(
        chapter.title,
        chapter.content || ''
      );

      // 2. Fetch news
      const response = await fetch('/api/search-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query || chapter.title })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch news');
      }

      const newsData = await response.json();

      let aiMsg: ChatMessage;
      if (!newsData || newsData.length === 0) {
        aiMsg = {
          id: uuidv4(),
          role: 'model',
          text: \`I couldn't find any recent news for "\${query}".\`
        };
      } else {
        aiMsg = {
          id: uuidv4(),
          role: 'model',
          text: \`Here are some recent news articles related to this topic (Searched for: "\${query}"):\`,
          type: 'news',
          news: newsData
        };
      }

      if (currentChapterId === chapter.id) {
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (err: any) {
      console.error(err);
      if (currentChapterId === chapter.id) {
        const errorMsg: ChatMessage = {
          id: uuidv4(),
          role: 'model',
          text: \`Failed to find news: \${err.message}\`
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } finally {
      if (currentChapterId === chapter.id) {
        setIsTyping(false);
      }
    }
  };

`;

if (!code.includes('handleFetchNews')) {
    code = code.replace("const handleFetchImages = async () => {", newsHandler + "const handleFetchImages = async () => {");
    fs.writeFileSync('src/components/ChatArea.tsx', code);
    console.log("Added handleFetchNews");
} else {
    console.log("handleFetchNews exists");
}
