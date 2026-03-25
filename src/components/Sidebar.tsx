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
    <div className="w-80 h-full bg-[#0f0f0f] border-r border-neutral-800 flex flex-col">
      <div className="p-4 border-b border-neutral-800 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-mono text-neutral-400 uppercase tracking-wider">Add Document</h2>
          <button onClick={() => setShowSettings(!showSettings)} className="text-neutral-500 hover:text-emerald-400 transition-colors">
            <Settings2 className="w-4 h-4" />
          </button>
        </div>

        {showSettings && (
          <div className="mb-4 p-3 bg-[#141414] border border-neutral-800 rounded-lg space-y-2 text-xs font-mono text-neutral-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={options.removeStopWords} onChange={e => setOptions({...options, removeStopWords: e.target.checked})} className="accent-emerald-500" />
              Remove Stop Words
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={options.applyStemming} onChange={e => setOptions({...options, applyStemming: e.target.checked})} className="accent-emerald-500" />
              Apply Basic Stemming
            </label>
          </div>
        )}

        <div {...getRootProps()} className={cn(
          "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors",
          isDragActive ? "border-emerald-500 bg-emerald-500/10" : "border-neutral-800 bg-[#141414] hover:border-emerald-500/50",
          isUploading && "opacity-50 pointer-events-none",
          (uploadError || localError) && "border-red-500/50 bg-red-500/5"
        )}>
          <input {...getInputProps()} />
          <UploadCloud className={cn("w-6 h-6 mx-auto mb-2", isDragActive ? "text-emerald-400" : (uploadError || localError) ? "text-red-400" : "text-neutral-500")} />
          <p className="text-xs font-mono text-neutral-300">
            {isUploading ? uploadProgress : "Drop PDF/DOCX/TXT here"}
          </p>
        </div>
        {(uploadError || localError) && (
          <p className="mt-2 text-xs text-red-400 font-mono bg-red-400/10 p-2 rounded border border-red-400/20">
            {localError || uploadError}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-mono text-neutral-400 uppercase tracking-wider">Library</h2>
          <button onClick={() => setSortBy(s => s === 'date' ? 'name' : 'date')} className="text-neutral-500 hover:text-emerald-400 transition-colors" title={`Sort documents by ${sortBy === 'date' ? 'name' : 'date'}`}>
            <ArrowUpDown className="w-3 h-3" />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-neutral-500" />
          <input 
            type="text" 
            title="Filter documents by name"
            placeholder="Filter documents..." 
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="w-full bg-[#141414] border border-neutral-800 rounded text-xs py-2 pl-8 pr-3 focus:outline-none focus:border-emerald-500/50 text-neutral-200 placeholder:text-neutral-600"
          />
        </div>

        <div className="space-y-2">
          {sortedDocs.map(doc => (
            <div key={doc.id} className="space-y-1">
              <div className="w-full flex items-center justify-between p-2 rounded hover:bg-neutral-800/50 transition-colors text-sm text-neutral-200">
                <button 
                  onClick={() => toggleDoc(doc.id)}
                  className="flex-1 flex items-center gap-2 text-left truncate"
                >
                  {expandedDocs.has(doc.id) ? <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0" />}
                  <Book className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="truncate">{doc.name}</span>
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(doc);
                  }}
                  className="p-1 text-neutral-500 hover:text-emerald-400 transition-colors shrink-0"
                  title="Download document"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
              
              {expandedDocs.has(doc.id) && (
                <div className="pl-6 space-y-1">
                  {doc.chapters.map(chapter => (
                    <button
                      key={chapter.id}
                      onClick={() => onSelectChapter(doc.id, chapter.id)}
                      className={cn(
                        "w-full text-left p-2 rounded text-xs transition-colors truncate border-l-2",
                        selectedChapterId === chapter.id 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500" 
                          : "text-neutral-400 hover:bg-neutral-800/50 border-transparent hover:border-neutral-700"
                      )}
                    >
                      {chapter.chapterNumber}. {chapter.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {sortedDocs.length === 0 && (
            <p className="text-xs text-neutral-600 text-center py-4 font-mono">No documents found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
