import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Document, PreprocessOptions, ReadingPersona } from '../types';
import { UploadCloud, Book, ChevronRight, ChevronDown, Settings2, Search, ArrowUpDown, Download, Trash2, MessageSquare, Camera, Share2, Tag, Plus, X, Copy, Check, Layers } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
}

export default function Sidebar({ documents, selectedDocId, selectedChapterId, onSelectChapter, onUpload, onDeleteDocument, onClearChats, onUpdateTags, onToggleShare, isUploading, uploadProgress, uploadError, persona, setPersona, librarySelection, onToggleLibrarySelection, onOpenLibraryChat }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [options, setOptions] = useState<PreprocessOptions>({ removeStopWords: false, applyStemming: false });
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
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={options.removeStopWords} onChange={e => setOptions({...options, removeStopWords: e.target.checked})} className="accent-cyan-500 w-4 h-4 rounded border-white/20 bg-transparent" />
                <span className="group-hover:text-white transition-colors">Remove Stop Words</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={options.applyStemming} onChange={e => setOptions({...options, applyStemming: e.target.checked})} className="accent-cyan-500 w-4 h-4 rounded border-white/20 bg-transparent" />
                <span className="group-hover:text-white transition-colors">Apply Stemming</span>
              </label>
            </div>
          </div>
        )}

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
        {sortedDocs.map(doc => (
          <div key={doc.id} className="border border-white/5 rounded-xl overflow-hidden bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
            <div 
              className={cn(
                "flex items-center justify-between p-3 cursor-pointer transition-colors",
                selectedDocId === doc.id ? "bg-cyan-500/10 border-l-2 border-l-cyan-400" : "border-l-2 border-l-transparent"
              )}
            >
              <div 
                className="flex items-center gap-3 flex-1 min-w-0"
                onClick={() => toggleDoc(doc.id)}
              >
                <div 
                  className="shrink-0 flex items-center justify-center w-5 h-5 cursor-pointer z-10"
                  onClick={(e) => { e.stopPropagation(); onToggleLibrarySelection(doc.id); }}
                >
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded border border-white/20 bg-black/40 accent-cyan-500 cursor-pointer pointer-events-none"
                    checked={librarySelection.has(doc.id)}
                    readOnly
                  />
                </div>
                {expandedDocs.has(doc.id) ? (
                  <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                )}
                <Book className={cn(
                  "w-4 h-4 shrink-0",
                  selectedDocId === doc.id ? "text-cyan-400" : "text-white/40"
                )} />
                <span className="text-sm font-medium text-white/80 truncate">{doc.name}</span>
              </div>
              <div className="flex items-center shrink-0 ml-2">
                <button 
                  onClick={(e) => handleShare(e, doc)}
                  className={cn("p-1.5 hover:bg-white/5 rounded-md transition-all", doc.isPublic ? "text-cyan-400" : "text-white/30 hover:text-cyan-400")}
                  title={doc.isPublic ? "Copy share link" : "Share document"}
                >
                  {copiedShareId === doc.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                  className="p-1.5 text-white/30 hover:text-cyan-400 hover:bg-white/5 rounded-md transition-all"
                  title="Download text"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                {onClearChats && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onClearChats(doc.id); }}
                    className="p-1.5 text-white/30 hover:text-yellow-400 hover:bg-white/5 rounded-md transition-all"
                    title="Clear all chats for this document"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDeleteDocument && (
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
                        <button onClick={(e) => { e.stopPropagation(); handleRemoveTag(doc, tag); }} className="hover:text-red-400"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                  {editingTagsFor === doc.id ? (
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
                  <div key={chapter.id} className="flex flex-col">
                    <button
                      onClick={() => !chapter.isGenerating && onSelectChapter(doc.id, chapter.id)}
                      disabled={chapter.isGenerating}
                      className={cn(
                        "w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between group",
                        selectedChapterId === chapter.id 
                          ? "text-cyan-400 bg-cyan-500/5 font-medium" 
                          : chapter.isGenerating
                            ? "text-white/30 bg-black/10 cursor-wait"
                            : "text-white/50 hover:text-white/80 hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          chapter.isGenerating ? "bg-cyan-400 opacity-100 animate-pulse" : "bg-current opacity-50"
                        )} />
                        <span className="truncate">{chapter.isGenerating ? 'Generating...' : chapter.title}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {chapter.isGenerating && (
                          <Loader2 className="w-3 h-3 text-cyan-400 animate-spin shrink-0 mr-1" />
                        )}
                        <span 
                          onClick={(e) => toggleSummary(e, chapter.id)}
                          className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Toggle Summary"
                        >
                          {expandedSummaries.has(chapter.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </span>
                      </div>
                    </button>
                    {expandedSummaries.has(chapter.id) && (
                      <div className="px-8 py-2 text-xs text-white/50 bg-black/10 border-l-2 border-white/5 ml-4 mr-4 mb-2 relative group/summary">
                        <div className="prose prose-invert prose-sm max-w-none font-light">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{chapter.summary}</ReactMarkdown>
                        </div>
                        <button
                          onClick={(e) => handleCopySummary(e, chapter.id, chapter.summary)}
                          className="absolute top-2 right-2 p-1 bg-black/40 hover:bg-black/60 rounded text-white/40 hover:text-cyan-400 opacity-0 group-hover/summary:opacity-100 transition-opacity"
                          title="Copy Summary"
                        >
                          {copiedSummaryId === chapter.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {sortedDocs.length === 0 && !isUploading && (
          <div className="text-center p-6 text-white/30 text-sm font-light">
            No documents found.
          </div>
        )}
      </div>
    </div>
  );
}
