import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Document, PreprocessOptions } from '../types';
import { UploadCloud, Book, ChevronRight, ChevronDown, Settings2, Search, ArrowUpDown, Download } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  documents: Document[];
  selectedDocId: string | null;
  selectedChapterId: string | null;
  onSelectChapter: (docId: string, chapterId: string) => void;
  onUpload: (files: File[], options: PreprocessOptions) => void;
  isUploading: boolean;
  uploadProgress: string;
  uploadError: string | null;
}

export default function Sidebar({ documents, selectedDocId, selectedChapterId, onSelectChapter, onUpload, isUploading, uploadProgress, uploadError }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [options, setOptions] = useState<PreprocessOptions>({ removeStopWords: false, applyStemming: false });
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [filterText, setFilterText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

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
      'text/plain': ['.txt']
    },
    maxSize: 300 * 1024 * 1024,
    disabled: isUploading
  });

  const toggleDoc = (id: string) => {
    const newSet = new Set(expandedDocs);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedDocs(newSet);
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
    .filter(d => d.name.toLowerCase().includes(filterText.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
    });

  return (
    <div className="w-80 h-full bg-[#0a0a0a]/50 backdrop-blur-xl border-r border-white/5 flex flex-col relative z-10">
      <div className="p-6 border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-display font-semibold text-white/40 uppercase tracking-widest">Library</h2>
          <button onClick={() => setShowSettings(!showSettings)} className="text-white/40 hover:text-cyan-400 transition-colors">
            <Settings2 className="w-4 h-4" />
          </button>
        </div>

        {showSettings && (
          <div className="mb-5 p-4 bg-white/5 border border-white/10 rounded-xl space-y-3 text-xs font-medium text-white/60">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={options.removeStopWords} onChange={e => setOptions({...options, removeStopWords: e.target.checked})} className="accent-cyan-500 w-4 h-4 rounded border-white/20 bg-transparent" />
              <span className="group-hover:text-white transition-colors">Remove Stop Words</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={options.applyStemming} onChange={e => setOptions({...options, applyStemming: e.target.checked})} className="accent-cyan-500 w-4 h-4 rounded border-white/20 bg-transparent" />
              <span className="group-hover:text-white transition-colors">Apply Stemming</span>
            </label>
          </div>
        )}

        <div 
          {...getRootProps()} 
          className={cn(
            "border border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 group relative overflow-hidden",
            isDragActive ? "border-cyan-400 bg-cyan-400/5" : "border-white/10 hover:border-cyan-400/50 hover:bg-white/5",
            isUploading ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
            (uploadError || localError) && "border-red-500/50 bg-red-500/5"
          )}
        >
          {isUploading && (
            <div className="absolute inset-0 bg-cyan-500/10 animate-pulse" />
          )}
          <input {...getInputProps()} />
          <UploadCloud className={cn(
            "w-8 h-8 mx-auto mb-3 transition-colors duration-300",
            isDragActive ? "text-cyan-400" : (uploadError || localError) ? "text-red-400" : "text-white/30 group-hover:text-cyan-400/70"
          )} />
          <p className="text-sm font-medium text-white/60 group-hover:text-white/80 transition-colors">
            {isUploading ? uploadProgress : 'Upload Document'}
          </p>
          <p className="text-xs text-white/30 mt-2 font-light">PDF, DOCX, TXT up to 300MB</p>
        </div>
        
        {(uploadError || localError) && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 font-medium">
            {uploadError || localError}
          </div>
        )}
      </div>

      <div className="p-4 border-b border-white/5 shrink-0 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input 
            type="text" 
            placeholder="Search library..." 
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
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
              <button 
                onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                className="p-1.5 text-white/30 hover:text-cyan-400 hover:bg-white/5 rounded-md transition-all shrink-0 ml-2"
                title="Download text"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {expandedDocs.has(doc.id) && (
              <div className="bg-black/20 border-t border-white/5 py-2">
                {doc.chapters.map(chapter => (
                  <button
                    key={chapter.id}
                    onClick={() => onSelectChapter(doc.id, chapter.id)}
                    className={cn(
                      "w-full text-left px-10 py-2 text-sm transition-colors flex items-center gap-2",
                      selectedChapterId === chapter.id 
                        ? "text-cyan-400 bg-cyan-500/5 font-medium" 
                        : "text-white/50 hover:text-white/80 hover:bg-white/5"
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 shrink-0" />
                    <span className="truncate">{chapter.title}</span>
                  </button>
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
