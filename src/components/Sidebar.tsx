import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Document, PreprocessOptions, ReadingPersona } from '../types';
import { UploadCloud, Book, ChevronRight, ChevronDown, Settings2, Search, ArrowUpDown, Download, Trash2, MessageSquare, Camera, Share2, Tag, Plus, X, Copy, Check, Layers, CheckCircle2, Circle, Loader2, BookOpen } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../contexts/AuthContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  documents: Document[];
  selectedDocId: string | null;
  selectedChapterId: string | null;
  onSelectChapter: (docId: string, chapterId: string) => void;
  onUpload: (files: File[], options: PreprocessOptions) => void;
  onDeleteDocument?: (docId: string) => void;
  onClearChats?: (docId: string) => void;
  onUpdateTags?: (docId: string, tags: string[]) => void;
  onToggleShare?: (docId: string, isPublic: boolean) => void;
  isUploading: boolean;
  uploadProgress: string;
  uploadError: string | null;
  persona: ReadingPersona;
  setPersona: (persona: ReadingPersona) => void;
  librarySelection: Set<string>;
  onToggleLibrarySelection: (docId: string) => void;
  onOpenLibraryChat: () => void;
  onUpdateSummary?: (chapterId: string, summary: string) => void;
}

interface ChapterNodeProps {
  chapter: any;
  docId: string;
  level: number;
  selectedChapterId: string | null;
  expandedChaptersList: Set<string>;
  expandedSummaries: Set<string>;
  toggleSummary: (e: React.MouseEvent, id: string) => void;
  onSelectChapter: (docId: string, chapterId: string) => void;
}

const ChapterNode = ({ 
  chapter, 
  docId, 
  level, 
  selectedChapterId, 
  expandedChaptersList, 
  expandedSummaries, 
  toggleSummary, 
  onSelectChapter,
  editingSummaryId,
  editingSummaryDraft,
  setEditingSummaryDraft,
  startEditingSummary,
  saveSummary,
  cancelEditingSummary,
  copiedSummaryId,
  handleCopySummary,
}: ChapterNodeProps & {
  editingSummaryId: string | null;
  editingSummaryDraft: string;
  setEditingSummaryDraft: (draft: string) => void;
  startEditingSummary: (e: React.MouseEvent, id: string, summary: string) => void;
  saveSummary: (e: React.MouseEvent, id: string) => void;
  cancelEditingSummary: (e: React.MouseEvent) => void;
  copiedSummaryId: string | null;
  handleCopySummary: (e: React.MouseEvent, id: string, summary: string) => void;
}) => {
  const { user } = useAuth();
  const [localExpanded, setLocalExpanded] = useState(level === 0 || chapter.type === 'part');
  const paddingLeft = `${level * 0.75 + 1}rem`;
  const hasChildren = chapter.children && chapter.children.length > 0;
  
  return (
    <div className="flex flex-col">
      <button
        onClick={() => {
          if (!chapter.isGenerating) {
            onSelectChapter(docId, chapter.id);
          }
        }}
        disabled={chapter.isGenerating}
        style={{ paddingLeft }}
        className={cn(
          "w-full text-left py-2 pr-4 text-sm transition-colors flex items-center justify-between group",
          selectedChapterId === chapter.id 
            ? "text-cyan-400 bg-cyan-500/5 font-medium" 
            : chapter.isGenerating
              ? "text-white/30 bg-black/10 cursor-wait"
              : "text-white/50 hover:text-white/80 hover:bg-white/5"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {hasChildren ? (
            <span 
              onClick={(e) => { e.stopPropagation(); setLocalExpanded(!localExpanded); }}
              className="p-1 hover:bg-white/10 rounded cursor-pointer shrink-0"
            >
              {localExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </span>
          ) : (
            <span className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0 ml-1",
              chapter.isGenerating ? "bg-cyan-400 opacity-100 animate-pulse" : "bg-current opacity-50"
            )} />
          )}
          <span className="truncate">{chapter.isGenerating ? 'Generating...' : chapter.title}</span>
        </div>
        <div className="flex items-center gap-1">
          {chapter.isGenerating && (
            <Loader2 className="w-3 h-3 text-cyan-400 animate-spin shrink-0 mr-1" />
          )}
          <span 
               onClick={(e) => { e.stopPropagation(); toggleSummary(e, chapter.id); }}
               className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
               title="Toggle Summary"
             >
            {expandedSummaries.has(chapter.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        </div>
      </button>

      {expandedSummaries.has(chapter.id) && (
        <div className="px-8 py-2 text-xs text-white/50 bg-black/10 border-l-2 border-white/5 ml-4 mr-4 mb-2 relative group/summary">
          {editingSummaryId === chapter.id && user?.role !== 'student' ? (
            <div className="flex flex-col gap-2 relative z-10" onClick={(e) => e.stopPropagation()}>
              <textarea
                value={editingSummaryDraft}
                onChange={(e) => setEditingSummaryDraft(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-white/80 min-h-[100px] resize-y outline-none focus:border-cyan-500/50"
              />
              <div className="flex justify-end gap-2">
                <button onClick={cancelEditingSummary} className="px-2 py-1 text-[10px] text-white/40 hover:text-white/80">Cancel</button>
                <button onClick={(e) => saveSummary(e, chapter.id)} className="px-2 py-1 text-[10px] bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30">Save</button>
              </div>
            </div>
          ) : (
            <>
              <div className="prose prose-invert prose-sm max-w-none font-light">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{chapter.summary}</ReactMarkdown>
              </div>
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/summary:opacity-100 transition-opacity">
                {user?.role !== 'student' && (
                  <button
                    onClick={(e) => startEditingSummary(e, chapter.id, chapter.summary)}
                    className="p-1 bg-black/40 hover:bg-black/60 rounded text-white/40 hover:text-cyan-400"
                    title="Edit Summary"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                )}
                <button
                  onClick={(e) => handleCopySummary(e, chapter.id, chapter.summary)}
                  className="p-1 bg-black/40 hover:bg-black/60 rounded text-white/40 hover:text-cyan-400"
                  title="Copy Summary"
                >
                  {copiedSummaryId === chapter.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {localExpanded && hasChildren && (
        <div className="flex flex-col border-l border-white/5 ml-[1.375rem] mt-1 mb-1">
          {chapter.children.map((child: any) => (
            <ChapterNode 
              key={child.id} 
              chapter={child} 
              docId={docId} 
              level={level + 1} 
              selectedChapterId={selectedChapterId}
              expandedChaptersList={expandedChaptersList}
              expandedSummaries={expandedSummaries}
              toggleSummary={toggleSummary}
              onSelectChapter={onSelectChapter}
              editingSummaryId={editingSummaryId}
              editingSummaryDraft={editingSummaryDraft}
              setEditingSummaryDraft={setEditingSummaryDraft}
              startEditingSummary={startEditingSummary}
              saveSummary={saveSummary}
              cancelEditingSummary={cancelEditingSummary}
              copiedSummaryId={copiedSummaryId}
              handleCopySummary={handleCopySummary}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function Sidebar({ documents, selectedDocId, selectedChapterId, onSelectChapter, onUpload, onDeleteDocument, onClearChats, onUpdateTags, onToggleShare, isUploading, uploadProgress, uploadError, persona, setPersona, librarySelection, onToggleLibrarySelection, onOpenLibraryChat, onUpdateSummary }: Props) {
  const { user } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [options, setOptions] = useState<PreprocessOptions>({ removeStopWords: false, applyStemming: false, summaryDetail: 'detailed' });
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [expandedChaptersList, setExpandedChaptersList] = useState<Set<string>>(new Set());
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [filterText, setFilterText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [editingTagsFor, setEditingTagsFor] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [copiedSummaryId, setCopiedSummaryId] = useState<string | null>(null);
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  
  const [editingSummaryId, setEditingSummaryId] = useState<string | null>(null);
  const [editingSummaryDraft, setEditingSummaryDraft] = useState('');
  
  const [userUsage, setUserUsage] = useState<any>(null);

  useEffect(() => {
    if (showSettings) {
      fetch('/api/user/usage')
        .then(res => res.json())
        .then(data => {
          if (!data.error) setUserUsage(data);
        })
        .catch(err => console.error("Could not fetch usage", err));
    }
  }, [showSettings]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      setLocalError(null);
      onUpload(files, options);
    },
    onDropRejected: (fileRejections) => {
      const rejection = fileRejections[0];
      const error = rejection.errors[0];
      if (error.code === 'file-too-large') {
        setLocalError('File too large. Maximum size is 300MB.');
      } else if (error.code === 'file-invalid-type') {
        setLocalError('Unsupported file type. Please upload PDF, DOCX, or TXT.');
      } else {
        setLocalError(error.message);
      }
    },
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'application/epub+zip': ['.epub'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    maxSize: 300 * 1024 * 1024,
    disabled: isUploading
  });

  const toggleDoc = (docId: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
        setExpandedChaptersList(chaptersNext => {
          const newSet = new Set(chaptersNext);
          newSet.delete(docId);
          return newSet;
        });
      } else {
        next.add(docId);
        setExpandedChaptersList(chaptersNext => {
          const newSet = new Set(chaptersNext);
          newSet.add(docId);
          return newSet;
        });
      }
      return next;
    });
  };

  const toggleChaptersList = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    setExpandedChaptersList(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const toggleSummary = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSet = new Set(expandedSummaries);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedSummaries(newSet);
  };

  const startEditingSummary = (e: React.MouseEvent, chapterId: string, currentSummary: string) => {
    e.stopPropagation();
    setEditingSummaryId(chapterId);
    setEditingSummaryDraft(currentSummary);
    setExpandedSummaries(prev => {
      const next = new Set(prev);
      next.add(chapterId);
      return next;
    });
  };

  const saveSummary = async (e: React.MouseEvent, chapterId: string) => {
    e.stopPropagation();
    if (editingSummaryDraft.trim()) {
       await onUpdateSummary?.(chapterId, editingSummaryDraft);
    }
    setEditingSummaryId(null);
  };

  const cancelEditingSummary = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSummaryId(null);
  };

  const handleCopySummary = (e: React.MouseEvent, id: string, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedSummaryId(id);
    setTimeout(() => setCopiedSummaryId(null), 2000);
  };

  const handleShare = (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    if (onToggleShare && !doc.isPublic) {
      onToggleShare(doc.id, true);
    }
    const url = `${window.location.origin}/?sharedDoc=${doc.id}`;
    navigator.clipboard.writeText(url);
    setCopiedShareId(doc.id);
    setTimeout(() => setCopiedShareId(null), 2000);
  };

  const handleAddTag = (doc: Document) => {
    if (!newTagInput.trim() || !onUpdateTags) return;
    const currentTags = doc.tags || [];
    if (!currentTags.includes(newTagInput.trim())) {
      onUpdateTags(doc.id, [...currentTags, newTagInput.trim()]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (doc: Document, tagToRemove: string) => {
    if (!onUpdateTags) return;
    const currentTags = doc.tags || [];
    onUpdateTags(doc.id, currentTags.filter(t => t !== tagToRemove));
  };

  const handleDownload = (doc: Document) => {
    const content = doc.chapters.map(ch => `${ch.chapterNumber}. ${ch.title}\n\n${ch.content}`).join('\n\n---\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name.endsWith('.txt') ? doc.name : `${doc.name}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sortedDocs = [...documents]
    .filter(d => {
      const matchesName = d.name.toLowerCase().includes(filterText.toLowerCase());
      const matchesTags = d.tags?.some(t => t.toLowerCase().includes(filterText.toLowerCase()));
      return matchesName || matchesTags;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
    });

  // Extract percentage from uploadProgress string e.g. "(45%)"
  const progressMatch = uploadProgress.match(/\((\d+)%\)/);
  const progressPercent = progressMatch ? parseInt(progressMatch[1], 10) : null;

  return (
    <div className="w-80 h-full bg-[#0a0a0a]/95 md:bg-[#0a0a0a]/50 backdrop-blur-xl border-r border-white/5 flex flex-col relative z-10">
      <div className="p-6 border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-display font-semibold text-white/40 uppercase tracking-widest">Library</h2>
          <button onClick={() => setShowSettings(!showSettings)} className="text-white/40 hover:text-cyan-400 transition-colors">
            <Settings2 className="w-4 h-4" />
          </button>
        </div>

        {showSettings && (
          <div className="mb-5 p-4 bg-white/5 border border-white/10 rounded-xl space-y-4 text-xs font-medium text-white/60">
            <div>
              <label className="text-white/40 mb-1.5 block uppercase tracking-wider text-[10px]">Reading Persona</label>
              <select 
                value={persona} 
                onChange={e => setPersona(e.target.value as ReadingPersona)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white/80 focus:outline-none focus:border-cyan-500/50"
              >
                <option value="general">Generic Assistant</option>
                <option value="student">Student (Simple, Analogies)</option>
                <option value="academic">Academic (Rigorous, Theory)</option>
                <option value="professional">Professional (Exec Brief)</option>
              </select>
            </div>
            <div className="space-y-3 pt-3 border-t border-white/5">
              <label className="text-white/40 mb-1.5 block uppercase tracking-wider text-[10px]">Processing Options</label>
              <div className="pb-2">
                <label className="text-white/40 mb-1.5 block text-[10px]">SUMMARY DETAIL</label>
                <select 
                  value={options.summaryDetail || 'detailed'} 
                  onChange={e => setOptions({...options, summaryDetail: e.target.value as any})}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white/80 focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="brief">Brief</option>
                  <option value="detailed">Detailed</option>
                  <option value="academic">Academic / Rigorous</option>
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={options.removeStopWords} onChange={e => setOptions({...options, removeStopWords: e.target.checked})} className="accent-cyan-500 w-4 h-4 rounded border-white/20 bg-transparent" />
                <span className="group-hover:text-white transition-colors">Remove Stop Words</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={options.applyStemming} onChange={e => setOptions({...options, applyStemming: e.target.checked})} className="accent-cyan-500 w-4 h-4 rounded border-white/20 bg-transparent" />
                <span className="group-hover:text-white transition-colors">Apply Stemming</span>
              </label>
            </div>
            {userUsage && (
              <div className="space-y-3 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-white/40 block uppercase tracking-wider text-[10px]">Subscription</label>
                  <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-[9px] uppercase font-bold tracking-widest">{userUsage.plan}</span>
                </div>
                
                <div className="space-y-2 text-[10px] text-white/50">
                  <div className="flex justify-between">
                    <span>Books:</span>
                    <span>{userUsage.usage.books_uploaded_this_month} / {userUsage.limits.document === 'unlimited' ? '∞' : userUsage.limits.document}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Video Gen:</span>
                    <span>{userUsage.usage.video_generations_this_month} / {userUsage.limits.video === 'unlimited' ? '∞' : userUsage.limits.video}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Images:</span>
                    <span>{userUsage.usage.image_searches_this_month} / {userUsage.limits.image === 'unlimited' ? '∞' : userUsage.limits.image}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Interactive:</span>
                    <span>{userUsage.usage.interactive_lessons_this_month} / {userUsage.limits.interactive === 'unlimited' ? '∞' : userUsage.limits.interactive}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Chat (Daily):</span>
                    <span>{userUsage.usage.chat_messages_today} / {userUsage.plan === 'free' || userUsage.plan === 'Starter' ? 10 : '∞'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>YouTube searches:</span>
                    <span>{userUsage.usage.youtube_searches_today} / {userUsage.limits.youtube === 'unlimited' ? '∞' : userUsage.limits.youtube} today</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {user?.role !== 'student' && (
          <div className="flex gap-2 mb-4">
            <div 
              {...getRootProps()} 
              className={cn(
                "flex-1 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 group relative overflow-hidden",
                isDragActive ? "border-cyan-400 bg-cyan-400/10" : "border-white/20 hover:border-cyan-400/60 hover:bg-white/10 bg-white/[0.02]",
                isUploading ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
                (uploadError || localError) && "border-red-500/50 bg-red-500/5"
              )}
            >
              {isUploading && (
                <div className="absolute inset-0 bg-cyan-500/10 animate-pulse" />
              )}
              {isUploading && progressPercent !== null && (
                <div 
                  className="absolute bottom-0 left-0 h-1 bg-cyan-400 transition-all duration-300 ease-out" 
                  style={{ width: `${progressPercent}%` }} 
                />
              )}
              <input {...getInputProps()} />
              <UploadCloud className={cn(
                "w-10 h-10 mx-auto mb-3 transition-all duration-300 transform group-hover:-translate-y-1 group-hover:scale-110",
                isDragActive ? "text-cyan-400" : (uploadError || localError) ? "text-red-400" : "text-white/50 group-hover:text-cyan-400"
              )} />
              <p className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">
                {isUploading ? uploadProgress : 'Drag & Drop or Click to Browse'}
              </p>
              {!isUploading && (
                <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                  {['PDF', 'EPUB', 'DOCX', 'TXT', 'IMG'].map(ext => (
                    <span key={ext} className="px-2 py-1 rounded bg-white/10 text-white/70 text-[10px] font-bold tracking-wider">
                      {ext}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <label className="flex flex-col items-center justify-center w-16 border border-white/10 rounded-xl cursor-pointer hover:bg-white/[0.02] hover:border-cyan-500/50 transition-all group">
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onUpload(Array.from(e.target.files), options);
                  }
                }}
                disabled={isUploading}
              />
              <Camera className="w-5 h-5 text-white/50 group-hover:text-cyan-400 transition-colors mb-1" />
              <span className="text-[10px] text-white/40 group-hover:text-white/60">Photo</span>
            </label>
          </div>
        )}
        
        {(uploadError || localError) && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 font-medium">
            {uploadError || localError}
          </div>
        )}
      </div>

      <div className="p-4 border-b border-white/5 shrink-0 space-y-3">
        {librarySelection.size > 1 && (
          <div className="mb-3">
            <button
              onClick={onOpenLibraryChat}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_20px_rgba(34,211,238,0.5)] hover:-translate-y-0.5"
            >
              <Layers className="w-4 h-4" /> Library Synthesis ({librarySelection.size})
            </button>
          </div>
        )}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input 
            type="text" 
            placeholder="Search library..." 
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-[16px] md:text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
          />
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-white/40">{sortedDocs.length} Documents</span>
          <button 
            onClick={() => setSortBy(s => s === 'date' ? 'name' : 'date')}
            className="flex items-center gap-1 text-xs font-medium text-white/40 hover:text-cyan-400 transition-colors"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortBy === 'date' ? 'Date' : 'Name'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {sortedDocs.map(doc => {
          const isSelectedForLibrary = librarySelection.has(doc.id);
          return (
          <div key={doc.id} className={cn(
            "border rounded-xl overflow-hidden transition-all duration-200",
            isSelectedForLibrary 
              ? "bg-cyan-500/10 border-cyan-400/50 shadow-[0_0_10px_rgba(34,211,238,0.1)]" 
              : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
          )}>
            <div 
              className={cn(
                "flex items-center justify-between p-3 cursor-pointer transition-colors",
                selectedDocId === doc.id && !isSelectedForLibrary ? "bg-cyan-500/10 border-l-2 border-l-cyan-400" : "border-l-2 border-l-transparent"
              )}
            >
              <div 
                className="flex items-center gap-3 flex-1 min-w-0"
                onClick={() => toggleDoc(doc.id)}
              >
                <div 
                  className="shrink-0 flex items-center justify-center w-6 h-6 cursor-pointer z-10 text-white/50 hover:text-cyan-400 transition-colors"
                  onClick={(e) => { e.stopPropagation(); onToggleLibrarySelection(doc.id); }}
                  title={isSelectedForLibrary ? "Remove from Library Chat" : "Add to Library Chat"}
                >
                  {isSelectedForLibrary ? (
                    <CheckCircle2 className="w-5 h-5 text-cyan-400 fill-cyan-400/20" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>
                {expandedDocs.has(doc.id) ? (
                  <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                )}
                <Book className={cn(
                  "w-4 h-4 shrink-0",
                  (selectedDocId === doc.id || isSelectedForLibrary) ? "text-cyan-400" : "text-white/40"
                )} />
                <span className={cn(
                  "text-sm truncate transition-colors",
                  isSelectedForLibrary ? "text-cyan-50 font-semibold" : "text-white/80 font-medium"
                )}>{doc.name}</span>
              </div>
              <div className="flex items-center shrink-0 ml-2">
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (selectedDocId === doc.id && selectedChapterId === 'read_all') {
                      onSelectChapter(doc.id, doc.chapters[0]?.id || '');
                    } else {
                      onSelectChapter(doc.id, 'read_all');
                    }
                  }}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    selectedDocId === doc.id && selectedChapterId === 'read_all'
                      ? "text-cyan-400 bg-white/10"
                      : "text-white/30 hover:text-cyan-400 hover:bg-white/5"
                  )}
                  title={selectedDocId === doc.id && selectedChapterId === 'read_all' ? "Exit Full Document" : "Read Full Document"}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                </button>
                {user?.role !== 'student' && (
                  <button 
                    onClick={(e) => handleShare(e, doc)}
                    className={cn("p-1.5 hover:bg-white/5 rounded-md transition-all", doc.isPublic ? "text-cyan-400" : "text-white/30 hover:text-cyan-400")}
                    title={doc.isPublic ? "Copy share link" : "Share document"}
                  >
                    {copiedShareId === doc.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                  className="p-1.5 text-white/30 hover:text-cyan-400 hover:bg-white/5 rounded-md transition-all"
                  title="Download text"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                {user?.role !== 'student' && onClearChats && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onClearChats(doc.id); }}
                    className="p-1.5 text-white/30 hover:text-yellow-400 hover:bg-white/5 rounded-md transition-all"
                    title="Clear all chats for this document"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                )}
                {user?.role !== 'student' && onDeleteDocument && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteDocument(doc.id); }}
                    className="p-1.5 text-white/30 hover:text-red-400 hover:bg-white/5 rounded-md transition-all"
                    title="Delete document and chats"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            
            {expandedDocs.has(doc.id) && (
              <div className="bg-black/20 border-t border-white/5 py-2">
                <div className="px-4 py-2 mb-2 border-b border-white/5">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {doc.tags?.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/60">
                        {tag}
                        {user?.role !== 'student' && <button onClick={(e) => { e.stopPropagation(); handleRemoveTag(doc, tag); }} className="hover:text-red-400"><X className="w-3 h-3" /></button>}
                      </span>
                    ))}
                  </div>
                  {user?.role !== 'student' && (
                    editingTagsFor === doc.id ? (
                      <div className="flex flex-col gap-2 mt-1">
                        <input 
                          type="text" 
                          value={newTagInput}
                          onChange={e => setNewTagInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag(doc);
                            } else if (e.key === 'Escape') {
                              setEditingTagsFor(null);
                            }
                          }}
                          placeholder="Type new tag..."
                          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                          autoFocus
                        />
                        <div className="flex items-center gap-1.5">
                          <button onClick={(e) => { e.stopPropagation(); handleAddTag(doc); }} className="flex-1 px-2 py-1 bg-cyan-500 hover:bg-cyan-400 text-black rounded text-[10px] font-semibold transition-colors">
                            Add
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingTagsFor(null); }} className="flex-1 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-medium transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); setEditingTagsFor(doc.id); }} className="text-[10px] text-white/40 hover:text-cyan-400 flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Add Tag
                      </button>
                    )
                  )}
                </div>
                
                <div 
                  className="px-4 py-2 flex items-center justify-between text-xs font-semibold text-white/50 cursor-pointer hover:text-white/80 transition-colors border-y border-white/5 bg-black/10"
                  onClick={(e) => toggleChaptersList(e, doc.id)}
                >
                  <span className="flex items-center gap-1.5 uppercase tracking-wider">
                    {expandedChaptersList.has(doc.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    Chapters ({doc.chapters.length})
                  </span>
                </div>
                
                {expandedChaptersList.has(doc.id) && doc.chapters.map(chapter => (
                  <ChapterNode 
                    key={chapter.id}
                    chapter={chapter}
                    docId={doc.id}
                    level={0}
                    selectedChapterId={selectedChapterId}
                    expandedChaptersList={expandedChaptersList}
                    expandedSummaries={expandedSummaries}
                    toggleSummary={toggleSummary}
                    onSelectChapter={onSelectChapter}
                    editingSummaryId={editingSummaryId}
                    editingSummaryDraft={editingSummaryDraft}
                    setEditingSummaryDraft={setEditingSummaryDraft}
                    startEditingSummary={startEditingSummary}
                    saveSummary={saveSummary}
                    cancelEditingSummary={cancelEditingSummary}
                    copiedSummaryId={copiedSummaryId}
                    handleCopySummary={handleCopySummary}
                  />
                ))}
              </div>
            )}
          </div>
        )})}
        {sortedDocs.length === 0 && !isUploading && (
          <div className="text-center p-6 text-white/30 text-sm font-light">
            No documents found.
          </div>
        )}
      </div>
    </div>
  );
}
