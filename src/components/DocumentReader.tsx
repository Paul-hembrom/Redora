import React, { useRef, useEffect, useState } from 'react';
import { Document } from '../types';
import { BookOpen, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { markdownComponents } from './MarkdownComponents';
import remarkGfm from 'remark-gfm';
import { ReadAloudButton } from './ReadAloudButton';
import { smartNormalizeText } from '../lib/utils';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface Props {
  document: Document;
  initialScrollChapterId?: string | null;
}

export default function DocumentReader({ document, initialScrollChapterId }: Props) {
  const chapterRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [readingProgress, setReadingProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    if (initialScrollChapterId && chapterRefs.current[initialScrollChapterId]) {
      setTimeout(() => {
        chapterRefs.current[initialScrollChapterId]?.scrollIntoView({ behavior: 'smooth' });
      }, 500); // Give rendering a moment
    }
  }, [initialScrollChapterId, document.id]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    
    const newProgress: Record<string, number> = {};
    Object.entries(chapterRefs.current).forEach(([id, el]) => {
      if (!el) return;
      const elTop = el.offsetTop;
      const elHeight = el.offsetHeight;
      const elBottom = elTop + elHeight;
      
      let progress = 0;
      if (scrollTop + clientHeight >= elBottom) {
        progress = 100;
      } else if (scrollTop <= elTop) {
        progress = 0;
      } else {
        progress = Math.min(100, Math.max(0, ((scrollTop + clientHeight - elTop) / elHeight) * 100));
      }
      newProgress[id] = progress;
    });
    setReadingProgress(newProgress);
  };

  const scrollToChapter = (id: string) => {
    const el = chapterRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleDownloadPdf = (chapter: any) => {
    const element = chapterRefs.current[chapter.id];
    if (!element) return;

    const opt = {
      margin:       0.5,
      filename:     `${chapter.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' as const }
    };

    // We can temporarily clone the node and remove elements we don't want in the PDF (like the download button or navigation links)
    const clone = element.cloneNode(true) as HTMLElement;
    
    // Remove the download button and navigation links from the clone
    const navLinks = clone.querySelector('.pdf-exclude');
    if (navLinks) {
        navLinks.remove();
    }
    const downloadBtns = clone.querySelectorAll('.download-btn');
    downloadBtns.forEach(btn => btn.remove());

    html2pdf().set(opt).from(clone).save();
  };

  const flattenChapters = (chapters: any[] = []): any[] => {
    const list: any[] = [];
    const traverse = (nodes: any[]) => {
      nodes.forEach(node => {
        list.push(node);
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      });
    };
    traverse(chapters);
    return list;
  };

  const flatChapters = flattenChapters(document.chapters);

  const handleExportAllExercises = () => {
    const exerciseChapters = flatChapters.filter(c => c.type === 'exercise');
    if (exerciseChapters.length === 0) {
      alert("No exercises found in this document.");
      return;
    }

    let textContent = `# All Exercises: ${document.name}\n\n`;
    exerciseChapters.forEach((chapter, index) => {
      // Find parent chapter title
      const parentChapter = flatChapters.find(c => c.id === chapter.parentId);
      const title = parentChapter ? `${parentChapter.title} - ${chapter.title}` : chapter.title;
      
      textContent += `## ${index + 1}. ${title}\n\n`;
      textContent += `${typeof chapter.content === 'string' ? chapter.content : ''}\n\n`;
      textContent += `---\n\n`;
    });

    const blob = new Blob([textContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${document.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_exercises.md`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full w-full bg-[#050505]">
      {/* Table of Contents - Sidebar */}
      <div className="w-full md:w-64 border-r border-white/5 bg-[#0a0a0a]/50 p-4 shrink-0 overflow-y-auto">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Table of Contents
        </h3>
        <ul className="space-y-2">
          {flatChapters.map((chapter) => {
            const progress = readingProgress[chapter.id] || 0;
            return (
              <li key={chapter.id} style={{ paddingLeft: chapter.type === 'topic' ? '1.5rem' : chapter.type === 'chapter' ? '0.75rem' : '0' }}>
                <div className="flex flex-col gap-1 w-full">
                  <button
                    onClick={() => scrollToChapter(chapter.id)}
                    className="text-left text-sm text-cyan-400 hover:text-cyan-300 w-full truncate transition-colors"
                    title={chapter.title}
                  >
                    {chapter.title}
                  </button>
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden w-full max-w-[80%]">
                    <div 
                      className="h-full bg-cyan-500 transition-all duration-300 ease-out" 
                      style={{ width: `${progress}%` }} 
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Reader View */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-8 lg:p-12 scroll-smooth"
      >
        <div className="max-w-4xl mx-auto space-y-16">
          <div className="border-b border-white/10 pb-8 flex justify-between items-start">
            <h1 className="text-3xl font-display font-bold text-white mb-4">{document.name}</h1>
            {flatChapters.length > 0 && (
              <button
                onClick={handleExportAllExercises}
                className="flex items-center gap-2 text-xs font-medium bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 px-4 py-2 rounded-lg transition-colors border border-cyan-500/20 shadow-lg"
                title="Export all exercises to text file"
              >
                <Download className="w-4 h-4" />
                <span>Export All Exercises</span>
              </button>
            )}
          </div>
          
          {flatChapters.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center text-white/50">
              <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 text-cyan-400/50">
                <BookOpen className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-semibold text-white/80 mb-2">No Content Yet</h2>
              <p>Curriculum content is not yet available for this grade and subject.</p>
            </div>
          )}

          {flatChapters.map((chapter, index) => {
            const prevChapter = index > 0 ? flatChapters[index - 1] : null;
            const nextChapter = index < flatChapters.length - 1 ? flatChapters[index + 1] : null;

            return (
              <div 
                key={chapter.id} 
                ref={el => { if (el) chapterRefs.current[chapter.id] = el; }}
                className="scroll-mt-12 group"
              >
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-2xl font-semibold text-white">
                    {chapter.title}
                  </h2>
                  <button 
                    onClick={() => handleDownloadPdf(chapter)}
                    className="download-btn flex items-center gap-2 text-xs font-medium bg-white/5 hover:bg-white/10 text-white/70 hover:text-white px-3 py-2 rounded-lg transition-colors border border-white/5"
                    title="Download as PDF"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                  </button>
                </div>
                
                {chapter.summary && (
                  <div className="bg-white/5 border-l-4 border-cyan-500/50 p-4 mb-8 rounded-r-lg relative group/summary">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Summary</h4>
                      <ReadAloudButton text={chapter.summary} className="bg-transparent" iconSizeClasses="w-4 h-4" />
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none text-white/70 font-light">
                      {(() => {
                        const content = typeof chapter.summary === 'string' ? smartNormalizeText(chapter.summary) : '';
                        let sentences: string[] = content.match(/[^.!?\n]+[.!?\n]+(\s|$)|[^.!?\n]+$/g) || [];
                        if (!sentences.length) { 
                          sentences = [content]; 
                        } else { 
                          sentences = sentences.map(s => s.trim()).filter(Boolean); 
                        }
                        
                        return sentences.map((s, idx) => (
                          <span key={idx} id={`tts-sentence-${idx}`}>
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                ...markdownComponents,
                                p: ({node, children, ...props}) => <span {...props}>{children} </span>
                              }}
                            >
                              {s}
                            </ReactMarkdown>
                          </span>
                        ));
                      })()}
                    </div>
                  </div>
                )}
                <div className="prose prose-invert max-w-none text-white/80 font-serif leading-relaxed markdown-body">
                  {(() => {
                    const content = typeof chapter.content === 'string' ? smartNormalizeText(chapter.content) : '';
                    let sentences: string[] = content.match(/[^.!?\n]+[.!?\n]+(\s|$)|[^.!?\n]+$/g) || [];
                    if (!sentences.length) { 
                      sentences = [content]; 
                    } else { 
                      sentences = sentences.map(s => s.trim()).filter(Boolean); 
                    }
                    
                    return sentences.map((s, idx) => (
                      <span key={idx} id={`tts-sentence-${idx}`}>
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            ...markdownComponents,
                            p: ({node, children, ...props}) => <span {...props}>{children} </span>
                          }}
                        >
                          {s}
                        </ReactMarkdown>
                      </span>
                    ));
                  })()}
                </div>

                {/* Chapter Navigation Linking */}
                <div className="pdf-exclude mt-12 flex justify-between items-center border-t border-white/5 pt-6 opacity-50 group-hover:opacity-100 transition-opacity">
                  {prevChapter ? (
                    <button 
                      onClick={() => scrollToChapter(prevChapter.id)}
                      className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-2"
                    >
                      &larr; Previous: {prevChapter.title}
                    </button>
                  ) : <div />}
                  {nextChapter ? (
                    <button 
                      onClick={() => scrollToChapter(nextChapter.id)}
                      className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-2"
                    >
                      Next: {nextChapter.title} &rarr;
                    </button>
                  ) : <div />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
