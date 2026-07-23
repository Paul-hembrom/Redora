const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const oldHandleFetchNewsRegex = /const handleFetchNews = async \(\) => \{[\s\S]*?if \(currentChapterId === chapter\.id\) \{\n        setIsTyping\(false\);\n      \}\n    \}\n  \};/;

const newHandleFetchNews = `const handleFetchNews = async () => {
    if (isTyping) return;
    const currentChapterId = chapter.id;

    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', text: "Find news articles for this topic." };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setError(null);

    try {
      // 1. Generate query
      const query = await generateNewsSearchQuery(
        chapter.title,
        chapter.content || ''
      );

      // 2. Fetch news summary
      const response = await fetch('/api/search-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: query || chapter.title,
          topicTitle: chapter.title,
          keyConcepts: (chapter as any).key_concepts ? (chapter as any).key_concepts.join(', ') : ''
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch news');
      }

      const newsData = await response.json();

      let aiMsg: ChatMessage = {
        id: uuidv4(),
        role: 'model',
        text: newsData.summary || \`I couldn't find any recent news for "\${query}".\`
      };

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
  };`;

code = code.replace(oldHandleFetchNewsRegex, newHandleFetchNews);

// Also remove the old news rendering block
const newsRenderBlockRegex = /\{msg\.news && msg\.news\.length > 0 && \([\s\S]*?<\/motion\.div>\n                \)\}/;
code = code.replace(newsRenderBlockRegex, '');

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Updated handleFetchNews and removed news render block");
