import React, { useState, useEffect } from 'react';
import { Search, FileText, MessageSquare, BookOpen, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from './ui/dialog';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';

interface SearchResult {
  documents: { id: string; name: string; upload_date: string }[];
  chapters: { id: string; document_id: string; chapter_number: number; title: string; summary: string; doc_name: string }[];
  chats: { id: string; chapter_id: string; text: string; role: string; chapter_title: string; doc_name: string; doc_id: string }[];
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (docId: string, chapterId?: string) => void;
}

export default function GlobalSearchModal({ isOpen, onClose, onSelectResult }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 bg-[#0a0a0a] border-white/10 text-white gap-0 overflow-hidden">
        <div className="flex items-center border-b border-white/10 px-4 py-3">
          <Search className="w-5 h-5 text-white/40 mr-3 shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents, chapters, and chats..."
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-base px-0 placeholder:text-white/30"
            autoFocus
          />
          {isLoading && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />}
        </div>
        
        <ScrollArea className="max-h-[60vh]">
          {results && (
            <div className="p-4 space-y-6">
              {results.documents.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-2">Documents</h3>
                  {results.documents.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => {
                        onSelectResult(doc.id);
                        onClose();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-md bg-cyan-500/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{doc.name}</p>
                        <p className="text-xs text-white/40 truncate">Uploaded {new Date(doc.upload_date).toLocaleDateString()}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.chapters.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-2">Chapters</h3>
                  {results.chapters.map(chapter => (
                    <button
                      key={chapter.id}
                      onClick={() => {
                        onSelectResult(chapter.document_id, chapter.id);
                        onClose();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-md bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <BookOpen className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">Chapter {chapter.chapter_number}: {chapter.title}</p>
                        <p className="text-xs text-white/40 truncate">in {chapter.doc_name}</p>
                        <div className="mt-1.5 p-2 bg-black/20 rounded-md border border-white/5">
                          <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">
                            <span className="font-medium text-white/80">Summary: </span>
                            {chapter.summary || 'Summary unavailable'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.chats.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-2">Chats</h3>
                  {results.chats.map(chat => (
                    <button
                      key={chat.id}
                      onClick={() => {
                        onSelectResult(chat.doc_id, chat.chapter_id);
                        onClose();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <MessageSquare className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-white/40 truncate mb-1">
                          {chat.role === 'user' ? 'You' : 'AI'} in {chat.chapter_title} ({chat.doc_name})
                        </p>
                        <div className="p-2 bg-black/20 rounded-md border border-white/5">
                          <p className="text-sm text-white/80 line-clamp-2 leading-relaxed font-light">"{chat.text}"</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.documents.length === 0 && results.chapters.length === 0 && results.chats.length === 0 && (
                <div className="text-center py-8 text-white/40 text-sm">
                  No results found for "{query}"
                </div>
              )}
            </div>
          )}
          
          {!results && !query && (
            <div className="p-8 text-center text-white/30 text-sm">
              Start typing to search across your documents, chapters, and chat history.
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
