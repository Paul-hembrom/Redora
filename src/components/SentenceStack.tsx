import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownComponents, QuestionContext } from './MarkdownComponents';

export function SentenceStack({
  blocks,
  idPrefix,
  isLargeFont,
  chapterId,
}: {
  blocks: string[];
  idPrefix: string;
  isLargeFont: boolean;
  chapterId?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail.idPrefix === idPrefix) {
        if (!e.detail.isLargeFont) {
          setActiveIndex(-1);
        } else {
          setActiveIndex(e.detail.index);
        }
      }
    };
    window.addEventListener('tts-active-index', handler);
    return () => window.removeEventListener('tts-active-index', handler);
  }, [idPrefix]);

  return (
    <>
      {blocks.map((s, idx) => {
        const isSpoken = isLargeFont && idx < activeIndex;
        const isActive = isLargeFont && idx === activeIndex;
        
        // We can tune maxHeight per font size, but we'll use a large enough value
        const maxH = 900; 

        return (
          <div
            key={idx}
            id={`${idPrefix}${idx}`}
            style={{
              maxHeight: isSpoken ? 0 : `${maxH}px`,
              opacity: isSpoken ? 0 : 1,
              marginBottom: isSpoken ? 0 : '0.75em',
              overflow: 'hidden',
              transition: 'max-height 450ms ease, opacity 300ms ease, margin-bottom 450ms ease',
            }}
            className={isActive ? 'bg-amber-400/70 rounded' : ''}
          >
            <QuestionContext.Provider value={{
              blockText: s,
              grade: undefined,
              subject: undefined,
              topic: chapterId || ''
            }}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {s}
              </ReactMarkdown>
            </QuestionContext.Provider>
          </div>
        );
      })}
    </>
  );
}
