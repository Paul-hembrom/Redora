const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// Add import
if (!code.includes("SentenceStack")) {
    code = code.replace("import { ReadAloudButton } from './ReadAloudButton';", "import { ReadAloudButton } from './ReadAloudButton';\nimport { SentenceStack } from './SentenceStack';");
}

const contentTarget = `                    return blocks.map((s, idx) => (
                      <QuestionContext.Provider key={idx} value={{
                        blockText: s,
                        grade: undefined,
                        subject: undefined,
                        topic: chapter.title
                      }}>
                        <div id={\`tts-chapter-\${chapter.id}-\${idx}\`}>
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {s}
                          </ReactMarkdown>
                        </div>
                      </QuestionContext.Provider>
                    ));`;

const contentReplacement = `                    const isLargeFont = isFocusMode && ['2xl', '3xl', '4xl', '5xl', '6xl'].includes(focusFontSize ? focusFontSize.toLowerCase() : '3xl');
                    if (isLargeFont) {
                      return <SentenceStack blocks={blocks} idPrefix={\`tts-chapter-\${chapter.id}-\`} isLargeFont={true} chapterId={chapter.title} />;
                    }

                    return blocks.map((s, idx) => (
                      <QuestionContext.Provider key={idx} value={{
                        blockText: s,
                        grade: undefined,
                        subject: undefined,
                        topic: chapter.title
                      }}>
                        <div id={\`tts-chapter-\${chapter.id}-\${idx}\`}>
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

// Update scroll to 0 behavior in ChatArea
const scrollEffect = `  useEffect(() => {
    if (chatContainerRef.current && chapter) {
      chatContainerRef.current.scrollTop = 0;
    }
  }, [chapter?.id]);`;

const newScrollEffect = `  useEffect(() => {
    if (chatContainerRef.current && chapter) {
      chatContainerRef.current.scrollTop = 0;
    }
  }, [chapter?.id]);

  useEffect(() => {
    const isLargeFont = isFocusMode && ['2xl', '3xl', '4xl', '5xl', '6xl'].includes((focusFontSize || '3xl').toLowerCase());
    if (isLargeFont && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = 0;
    }
  }, [isFocusMode, focusFontSize]);`;

if (code.includes(scrollEffect) && !code.includes("const isLargeFont = isFocusMode && ['2xl'")) {
    code = code.replace(scrollEffect, newScrollEffect);
} else if (!code.includes("const isLargeFont = isFocusMode && ['2xl'")) {
    // try another hook
    const alternativeEffect = `  const currentChapterIdRef = useRef(chapter.id);`;
    code = code.replace(alternativeEffect, alternativeEffect + `\n  useEffect(() => {\n    const isLargeFont = isFocusMode && ['2xl', '3xl', '4xl', '5xl', '6xl'].includes((focusFontSize || '3xl').toLowerCase());\n    if (isLargeFont && chatContainerRef.current) {\n      chatContainerRef.current.scrollTop = 0;\n    }\n  }, [isFocusMode, focusFontSize]);`);
}

fs.writeFileSync('src/components/ChatArea.tsx', code);
