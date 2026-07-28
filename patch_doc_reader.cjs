const fs = require('fs');
let code = fs.readFileSync('src/components/DocumentReader.tsx', 'utf8');

// Add import
if (!code.includes("SentenceStack")) {
    code = code.replace("import { ReadAloudButton } from './ReadAloudButton';", "import { ReadAloudButton } from './ReadAloudButton';\nimport { SentenceStack } from './SentenceStack';");
}

// Replace summary rendering
const summaryTarget = `                        return blocks.map((s, idx) => (
                          <div key={idx} id={\`tts-summary-\${idx}\`}>
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={markdownComponents}
                            >
                              {s}
                            </ReactMarkdown>
                          </div>
                        ));`;
const summaryReplacement = `                        const isLargeFont = isFocusMode && ['2xl', '3xl', '4xl', '5xl', '6xl'].includes(focusFontSize.toLowerCase());
                        if (isLargeFont) {
                          return <SentenceStack blocks={blocks} idPrefix="tts-summary-" isLargeFont={true} chapterId={chapter.title} />;
                        }
                        
                        return blocks.map((s, idx) => (
                          <div key={idx} id={\`tts-summary-\${idx}\`}>
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={markdownComponents}
                            >
                              {s}
                            </ReactMarkdown>
                          </div>
                        ));`;
code = code.replace(summaryTarget, summaryReplacement);

// Replace content rendering
const contentTarget = `                    return blocks.map((s, idx) => (
                      <QuestionContext.Provider key={idx} value={{
                        blockText: s,
                        grade: undefined,
                        subject: undefined,
                        topic: chapter.title
                      }}>
                        <div id={\`tts-chapter-\${idx}\`}>
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {s}
                          </ReactMarkdown>
                        </div>
                      </QuestionContext.Provider>
                    ));`;
const contentReplacement = `                    const isLargeFont = isFocusMode && ['2xl', '3xl', '4xl', '5xl', '6xl'].includes(focusFontSize.toLowerCase());
                    if (isLargeFont) {
                      return <SentenceStack blocks={blocks} idPrefix="tts-chapter-" isLargeFont={true} chapterId={chapter.title} />;
                    }

                    return blocks.map((s, idx) => (
                      <QuestionContext.Provider key={idx} value={{
                        blockText: s,
                        grade: undefined,
                        subject: undefined,
                        topic: chapter.title
                      }}>
                        <div id={\`tts-chapter-\${idx}\`}>
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {s}
                          </ReactMarkdown>
                        </div>
                      </QuestionContext.Provider>
                    ));`;
code = code.replace(contentTarget, contentReplacement);

// Update scroll to 0 behavior in DocumentReader
const scrollEffect = `  useEffect(() => {
    if (initialScrollChapterId && chapterRefs.current[initialScrollChapterId]) {
      setTimeout(() => {
        chapterRefs.current[initialScrollChapterId]?.scrollIntoView({ behavior: 'smooth' });
      }, 500); // Give rendering a moment
    }
  }, [initialScrollChapterId, document.id]);`;

const newScrollEffect = `  useEffect(() => {
    if (initialScrollChapterId && chapterRefs.current[initialScrollChapterId]) {
      setTimeout(() => {
        chapterRefs.current[initialScrollChapterId]?.scrollIntoView({ behavior: 'smooth' });
      }, 500); // Give rendering a moment
    }
  }, [initialScrollChapterId, document.id]);

  useEffect(() => {
    const isLargeFont = isFocusMode && ['2xl', '3xl', '4xl', '5xl', '6xl'].includes((focusFontSize || '3xl').toLowerCase());
    if (isLargeFont && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [isFocusMode, focusFontSize]);`;

if (!code.includes("containerRef.current.scrollTop = 0")) {
    code = code.replace(scrollEffect, newScrollEffect);
}

fs.writeFileSync('src/components/DocumentReader.tsx', code);
