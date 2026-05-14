import React, { useRef, useEffect } from 'react';
import { Document } from '../types';
import { BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  document: Document;
}

export default function DocumentReader({ document }: Props) {
  const chapterRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const scrollToChapter = (id: string) => {
    const el = chapterRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full w-full bg-[#050505]">
      {/* Table of Contents - Sidebar */}
      <div className="w-full md:w-64 border-r border-white/5 bg-[#0a0a0a]/50 p-4 shrink-0 overflow-y-auto">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Table of Contents
        </h3>
        <ul className="space-y-2">
          {document.chapters.map(chapter => (
            <li key={chapter.id}>
              <button
                onClick={() => scrollToChapter(chapter.id)}
                className="text-left text-sm text-cyan-400 hover:text-cyan-300 w-full truncate transition-colors"
                title={chapter.title}
              >
                {chapter.chapterNumber}. {chapter.title}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Reader View */}
      <div className="flex-1 overflow-y-auto p-8 lg:p-12 scroll-smooth">
        <div className="max-w-4xl mx-auto space-y-16">
          <div className="border-b border-white/10 pb-8">
            <h1 className="text-3xl font-display font-bold text-white mb-4">{document.name}</h1>
          </div>
          
          {document.chapters.map((chapter) => (
            <div 
              key={chapter.id} 
              ref={el => chapterRefs.current[chapter.id] = el}
              className="scroll-mt-12"
            >
              <h2 className="text-2xl font-semibold text-white mb-6">Chapter {chapter.chapterNumber}: {chapter.title}</h2>
              <div className="prose prose-invert max-w-none text-white/80 whitespace-pre-wrap font-serif leading-relaxed">
                {chapter.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
