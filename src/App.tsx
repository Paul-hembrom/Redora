import React, { useState, useEffect } from 'react';
import { Document, PreprocessOptions, ChatMessage, ReadingPersona } from './types';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import DocumentReader from './components/DocumentReader';
import Login from './components/Login';
import Signup from './components/storyboard/Signup';
import Pricing from './components/Pricing';
import GlobalSearchModal from './components/GlobalSearchModal';
import TerminologyExtractorModal from './components/TerminologyExtractorModal';
import QuizDashboardModal from './components/QuizDashboardModal';
import { useAuth } from './contexts/AuthContext';
import { processDocument } from './lib/documentProcessor';
import { generateChatResponse } from './lib/gemini';
import { v4 as uuidv4 } from 'uuid';
import { BookOpen, LogOut, User as UserIcon, Menu, X, Search, UploadCloud, Sun, Moon, Lock, RefreshCw } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';

import { CreditsPanel } from './components/CreditsPanel';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Helpers ---
const flattenChapters = (chapters: any[] = [], parentPrefix: string = ''): any[] => {
  let result: any[] = [];
  if (!Array.isArray(chapters)) return result;
  
  const sorted = [...chapters].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  
  sorted.forEach((ch, index) => {
    let displayNumber = '';
    
    if (!parentPrefix) {
      displayNumber = `${ch.chapterNumber}`;
    } else {
      let subIdentifier = '';
      const match = ch.title.match(/^([a-zA-Z]|\d+)\.\s*/);
      if (match) {
        subIdentifier = match[1].toLowerCase();
      } else {
        subIdentifier = String.fromCharCode(97 + index);
      }
      displayNumber = `${parentPrefix}.${subIdentifier}`;
    }
    
    const newCh = { ...ch, displayNumber };
    result.push(newCh);
    if (ch.children) {
      result = result.concat(flattenChapters(ch.children, displayNumber));
    }
  });
  return result;
};

export default function App() {
  const { user, loading, logout, isOffline } = useAuth();
  const [isStudent, setIsStudent] = useState(user?.role === 'student');

  useEffect(() => {
    if (user?.role === 'student') {
      setIsStudent(true);
    } else if (user) {
      fetch('/api/me/context')
        .then(res => res.json())
        .then(data => {
          if (data && data.role === 'student') {
            setIsStudent(true);
          } else {
            setIsStudent(false);
          }
        })
        .catch(console.error);
    } else {
      setIsStudent(false);
    }
  }, [user]);

  const [showLogin, setShowLogin] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isTerminologyModalOpen, setIsTerminologyModalOpen] = useState(false);
  const [terminologyDoc, setTerminologyDoc] = useState<Document | null>(null);
  const [isQuizDashboardOpen, setIsQuizDashboardOpen] = useState(false);
  
  const [librarySelection, setLibrarySelection] = useState<Set<string>>(new Set());
  const [isLibraryChatActive, setIsLibraryChatActive] = useState(false);
  
  const [persona, setPersona] = useState<ReadingPersona>(() => {
    return (localStorage.getItem('readora_persona') as ReadingPersona) || 'general';
  });

  useEffect(() => {
    localStorage.setItem('readora_persona', persona);
  }, [persona]);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (isSyncing || isOffline) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDocuments(data);
          import('./lib/offline').then(m => m.cacheDocuments(data));
        }
      }
    } catch (err) {
      console.error('Failed to sync:', err);
    } finally {
      setIsSyncing(false);
    }
  };
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const [summarizingChapters, setSummarizingChapters] = useState<Set<string>>(new Set());

  const { getRootProps: getEmptyRootProps, getInputProps: getEmptyInputProps, isDragActive: isEmptyDragActive } = useDropzone({
    onDrop: (files) => {
      if (isStudent) return;
      handleUpload(files, { removeStopWords: false, applyStemming: false });
    },
    noClick: isStudent,
    noKeyboard: isStudent,
    noDrag: isStudent,
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
    disabled: isUploading || isOffline
  });

  const [sharedPublicDoc, setSharedPublicDoc] = useState<Document | null>(null);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return document.documentElement.classList.contains('dark') || true;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    const handleOpenQuizDashboard = () => setIsQuizDashboardOpen(true);
    window.addEventListener('open-quiz-dashboard', handleOpenQuizDashboard);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-quiz-dashboard', handleOpenQuizDashboard);
    };
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedDocId = urlParams.get('sharedDoc');

    if (sharedDocId) {
      if (user) {
        // Handled inside the main fetch below
        return;
      }
      
      // Fetch public doc if not logged in
      fetch(`/api/shared/${sharedDocId}`)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Not public or not found');
        })
        .then(data => {
          setSharedPublicDoc(data);
        })
        .catch(console.error);
    }
  }, [user]);

  const [isDocsLoading, setIsDocsLoading] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedDocId = urlParams.get('sharedDoc');

    if (user) {
      setIsDocsLoading(true);
      setDocuments([]); // Clear any old docs immediately upon getting a new user context
      if (!navigator.onLine) {
         import('./lib/offline').then(m => m.getCachedDocuments()).then(docs => {
            setDocuments(docs);
            setIsDocsLoading(false);
         });
         return;
      }
      
      // Sequence initialization: fetch context, then documents
      fetch('/api/me/context')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch org context');
          return res.json();
        })
        .then(() => fetch('/api/documents'))
        .then(res => {
          if (res.status === 401) {
            logout();
            throw new Error('Unauthorized');
          }
          return res.json();
        })
        .then(async data => {
          if (Array.isArray(data)) {
            console.log("Fetched docs:", data.length, data.map(d => d.id));
            let docs = data;
            
            // If there's a shared doc ID and it's not in the user's docs, fetch it
            if (sharedDocId && !docs.some(d => d.id === sharedDocId)) {
              try {
                const sharedRes = await fetch(`/api/shared/${sharedDocId}`);
                if (sharedRes.ok) {
                  const sharedDoc = await sharedRes.json();
                  docs = [sharedDoc, ...docs];
                  setSelectedDocId(sharedDoc.id);
                  if (sharedDoc.chapters.length > 0) {
                    setSelectedChapterId(sharedDoc.chapters[0].id);
                  }
                }
              } catch (err) {
                console.error('Failed to fetch shared document:', err);
              }
            } else if (sharedDocId && docs.some(d => d.id === sharedDocId)) {
               setSelectedDocId(sharedDocId);
               const doc = docs.find(d => d.id === sharedDocId);
               if (doc && doc.chapters.length > 0) {
                 setSelectedChapterId(doc.chapters[0].id);
               }
            }
            
            setDocuments(docs);
          } else {
            console.error('Failed to fetch documents:', data);
            setDocuments([]);
          }
        })
        .catch(err => console.error('Failed to fetch documents', err))
        .finally(() => setIsDocsLoading(false));
    } else {
      setIsDocsLoading(false);
    }
  }, [user, logout]);

  useEffect(() => {
    if (selectedDocId) {
      const doc = Array.isArray(documents) ? documents.find(d => d.id === selectedDocId) : undefined;
      if (doc && doc.chapters && doc.chapters.length > 0) {
        const flat = flattenChapters(doc.chapters);
        if (selectedChapterId !== 'read_all' && !flat.some(c => c.id === selectedChapterId)) {
          setSelectedChapterId(flat[0].id);
        }
      }
    }
  }, [selectedDocId, documents, selectedChapterId]);

  const isPricingPage = window.location.pathname === '/pricing';
  if (isPricingPage) {
    return <Pricing />;
  }

  // Using loading from auth context + isDocsLoading for initial state fetch
  if (loading || (user && isDocsLoading)) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)] mb-4">
          <BookOpen className="w-6 h-6 animate-pulse" />
        </div>
        <p className="text-white/40 font-display tracking-widest uppercase text-sm font-medium animate-pulse">Loading Readora</p>
      </div>
    );
  }

  if (sharedPublicDoc && !user) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 shrink-0 bg-[#0a0a0a]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-display font-semibold tracking-wide text-white/90">Readora <span className="text-cyan-400 font-light ml-1">Reader</span></h1>
            <span className="ml-4 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Public Shared Link</span>
          </div>
          <button onClick={() => setShowLogin(true)} className="text-sm font-medium text-cyan-400 hover:text-cyan-300">Sign in to interact</button>
        </header>
        <div className="flex-1 overflow-hidden">
          <DocumentReader document={sharedPublicDoc} />
        </div>
      </div>
    );
  }

  if (!user) {
    return showLogin ? 
      <Login onSwitchToSignup={() => setShowLogin(false)} /> : 
      <Signup onSwitchToLogin={() => setShowLogin(true)} />;
  }

  const handleSummarizeChapter = async (docId: string, chapterId: string) => {
    if (isStudent) return; // Optional check

    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    const flatChapters = flattenChapters(doc.chapters);
    const chapter = flatChapters.find(c => c.id === chapterId);
    if (!chapter) return;

    setSummarizingChapters(prev => new Set(prev).add(chapterId));

    try {
      const response = await fetch(`/api/chapters/${chapterId}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summaryDetail: 'detailed' })
      });
      if (!response.ok) {
         const data = await response.json();
         throw new Error(data.error || 'Failed to summarize');
      }
      const data = await response.json();
      
      // Update UI 
      handleUpdateSummary(chapterId, data.summary);
      if (data.title && data.title !== 'Section' && data.title !== 'Topic') {
         // Optionally update title if generated
         setDocuments(prev => prev.map(d => {
            if (d.id !== docId) return d;
            const updatedChaps = d.chapters.map(c => c.id === chapterId ? { ...c, title: data.title } : c);
            return { ...d, chapters: updatedChaps };
         }));
      }
    } catch (err: any) {
       console.error("Summarize error:", err);
       alert(`Summarize failed: ${err.message}`);
    } finally {
       setSummarizingChapters(prev => {
         const next = new Set(prev);
         next.delete(chapterId);
         return next;
       });
    }
  };

  const handleUpload = async (files: File[], options: PreprocessOptions) => {
    if (isStudent) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      for (const file of files) {
        const tempDocId = uuidv4();
        
        const chapters = await processDocument(file, options, setUploadProgress, {
          onDiscovered: (initialChapters) => {
            const newDoc: Document = {
              id: tempDocId,
              name: file.name,
              uploadDate: new Date().toISOString(),
              chapters: initialChapters
            };
            setDocuments(prev => [newDoc, ...prev]);
            if (!selectedDocId) {
              setSelectedDocId(newDoc.id);
              if (initialChapters.length > 0) {
                setSelectedChapterId(initialChapters[0].id);
              }
            }
          },
          onChapterDone: (idOrIdx: any, title: string, summary: string) => {
            setDocuments(prev => prev.map(d => {
              if (d.id !== tempDocId) return d;
              const nextChap = [...d.chapters];
              
              // Find by id if idOrIdx is string (we changed to passing ID, but handle both)
              let targetIdx = typeof idOrIdx === 'number' ? idOrIdx : nextChap.findIndex(c => c.id === idOrIdx);
              if (targetIdx >= 0 && targetIdx < nextChap.length) {
                 nextChap[targetIdx] = { ...nextChap[targetIdx], title, summary, isGenerating: false };
              }
              return { ...d, chapters: nextChap };
            }));
          }
        });

        const finalDoc: Document = {
          id: tempDocId,
          name: file.name,
          uploadDate: new Date().toISOString(),
          chapters
        };
        
        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalDoc)
        });

        if (!res.ok) {
           const errData = await res.json().catch(() => ({}));
           throw new Error(errData.error || 'Failed to sync document to server');
        }

        // Re-fetch document list after successful upload
        try {
          const docsRes = await fetch('/api/documents');
          if (docsRes.ok) {
            const data = await docsRes.json();
            if (Array.isArray(data)) {
              setDocuments(data);
              import('./lib/offline').then(m => m.cacheDocuments(data));
              
              // Find the newly uploaded document (by tempDocId which was preserved, or just use the response if available)
              const newDocInList = data.find((d: any) => d.id === finalDoc.id);
              if (newDocInList) {
                setSelectedDocId(newDocInList.id);
                // Clear selectedChapter or currentChapterId state so the reader shows the new book's first chapter
                if (newDocInList.chapters && newDocInList.chapters.length > 0) {
                  setSelectedChapterId(newDocInList.chapters[0].id);
                } else {
                  setSelectedChapterId(null);
                }
              }
            }
          }
        } catch (e) {
          console.error('Failed to refetch documents after upload', e);
        }

        window.dispatchEvent(new Event('usage-updated'));
      }
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'Failed to process document. Please ensure it is a valid PDF, DOCX, or TXT file.');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleSelectChapter = (docId: string, chapterId: string) => {
    setSelectedDocId(docId);
    setSelectedChapterId(chapterId);
    setIsLibraryChatActive(false);
    setIsSidebarOpen(false); // Close sidebar on mobile when a chapter is selected
  };

  const handleToggleLibrarySelection = (docId: string) => {
    setLibrarySelection(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const handleOpenLibraryChat = () => {
    setIsLibraryChatActive(true);
    setSelectedDocId(null);
    setSelectedChapterId(null);
    setIsSidebarOpen(false);
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete document');
      
      setDocuments(prev => prev.filter(d => d.id !== docId));
      if (selectedDocId === docId) {
        setSelectedDocId(null);
        setSelectedChapterId(null);
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  const handleClearChats = async (docId: string) => {
    try {
      const res = await fetch(`/api/chats/document/${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear chats');
      
      // Force a re-render of ChatArea by toggling selected chapter briefly
      // or we can just let the ChatArea handle it if we add a refresh trigger.
      // Easiest is to just reload the page or clear the current messages if it's the active doc.
      if (selectedDocId === docId && selectedChapterId) {
        const currentChapterId = selectedChapterId;
        setSelectedChapterId(null);
        setTimeout(() => setSelectedChapterId(currentChapterId), 10);
      }
    } catch (err) {
      console.error('Error clearing chats:', err);
    }
  };

  const handleUpdateTags = async (docId: string, tags: string[]) => {
    try {
      const res = await fetch(`/api/documents/${docId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
      });
      if (!res.ok) throw new Error('Failed to update tags');
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, tags } : d));
    } catch (err) {
      console.error('Error updating tags:', err);
    }
  };

  const handleToggleShare = async (docId: string, isPublic: boolean) => {
    try {
      const res = await fetch(`/api/documents/${docId}/share`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic })
      });
      if (!res.ok) throw new Error('Failed to update share status');
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, isPublic } : d));
    } catch (err) {
      console.error('Error updating share status:', err);
    }
  };

  const updateChapterInTree = (chapters: any[], id: string, updater: (ch: any) => any): any[] => {
    return chapters.map(ch => {
      if (ch.id === id) {
        return updater(ch);
      } else if (ch.children) {
        return { ...ch, children: updateChapterInTree(ch.children, id, updater) };
      }
      return ch;
    });
  };

  const handleUpdateSummary = async (chapterId: string, summary: string) => {
    // ... remain the same from 345 down to 363 ...
    try {
      const res = await fetch(`/api/chapters/${chapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary })
      });
      if (!res.ok) throw new Error('Failed to update summary');
      setDocuments(prev => prev.map(d => {
        const flat = flattenChapters(d.chapters);
        const hasChap = flat.some(c => c.id === chapterId);
        if (!hasChap) return d;
        const nextChap = updateChapterInTree(d.chapters, chapterId, ch => ({ ...ch, summary }));
        return { ...d, chapters: nextChap };
      }));
    } catch (err) {
      console.error('Error updating summary:', err);
    }
  };

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    }
  };

  const safeDocuments = Array.isArray(documents) ? documents : [];
  const selectedDoc = safeDocuments.find(d => d.id === selectedDocId);
  const selectedChapter = selectedDoc && Array.isArray(selectedDoc.chapters) ? flattenChapters(selectedDoc.chapters).find(c => c.id === selectedChapterId) : undefined;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#050505] text-white font-sans overflow-hidden">
      {/* Global Sync Indicator */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a] border border-white/10 shadow-lg shadow-black/50 rounded-full px-4 py-2 flex items-center gap-3"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
            <span className="text-sm font-medium text-white/90">Syncing library...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navigation Header */}
      <header className="h-16 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6 shrink-0 z-30 relative">
        <div className="flex items-center gap-3">
          <button 
            className="md:hidden p-2 -ml-2 text-white/70 hover:text-white transition-colors"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hidden sm:flex">
            <BookOpen className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-lg tracking-wide">READORA</h1>
            {isStudent && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-medium tracking-wide shadow-lg shadow-cyan-900/20">
                <Lock className="w-3 h-3" />
                <span className="hidden sm:inline uppercase">Read-Only Mode</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <button
            onClick={handleSync}
            disabled={isSyncing || isOffline}
            title="Sync offline changes"
            className={cn(
              "flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all duration-300",
              isSyncing 
                ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" 
                : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white",
              isOffline && "opacity-50 cursor-not-allowed"
            )}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Syncing...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sync Now</span>
              </>
            )}
          </button>
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="hidden sm:block">
            <CreditsPanel />
          </div>
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-sm text-white/50 font-medium hidden sm:flex">
            <UserIcon className="w-4 h-4" />
            <span className="truncate max-w-[100px] md:max-w-none">{user.name}</span>
          </div>
          <button 
            onClick={logout}
            className="text-white/40 hover:text-red-400 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {isOffline && (
        <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-2 flex items-center justify-center text-orange-400 text-xs md:text-sm font-medium w-full z-40 shrink-0">
          You are offline. Some features (AI chat, video generation) are unavailable.
        </div>
      )}

      <GlobalSearchModal 
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectResult={(docId, chapterId) => {
          setSelectedDocId(docId);
          if (chapterId) {
            setSelectedChapterId(chapterId);
          } else {
            const doc = documents.find(d => d.id === docId);
            if (doc && doc.chapters.length > 0) {
              setSelectedChapterId(doc.chapters[0].id);
            }
          }
          setIsLibraryChatActive(false);
          setIsSidebarOpen(false);
        }}
      />

      <TerminologyExtractorModal
        isOpen={isTerminologyModalOpen}
        onClose={() => setIsTerminologyModalOpen(false)}
        document={terminologyDoc}
      />
      
      <QuizDashboardModal
        isOpen={isQuizDashboardOpen}
        onClose={() => setIsQuizDashboardOpen(false)}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        <div className={`absolute md:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out flex ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <Sidebar 
            documents={safeDocuments}
            selectedDocId={selectedDocId}
            selectedChapterId={selectedChapterId}
            onSelectChapter={handleSelectChapter}
            onUpload={handleUpload}
            onDeleteDocument={handleDeleteDocument}
            onClearChats={handleClearChats}
            onUpdateTags={handleUpdateTags}
            onToggleShare={handleToggleShare}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            uploadError={uploadError}
            persona={persona}
            setPersona={setPersona}
            librarySelection={librarySelection}
            onToggleLibrarySelection={handleToggleLibrarySelection}
            onOpenLibraryChat={handleOpenLibraryChat}
            onUpdateSummary={handleUpdateSummary}
            onSummarizeChapter={handleSummarizeChapter}
            summarizingChapters={summarizingChapters}
            onOpenTerminology={(doc) => {
              setTerminologyDoc(doc);
              setIsTerminologyModalOpen(true);
            }}
          />
        </div>
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-0">
          {(() => {
            let activeChapter = selectedChapter;

            if (isLibraryChatActive && librarySelection.size > 1) {
              const selectedDocs = safeDocuments.filter(d => librarySelection.has(d.id));
              const sortedIds = selectedDocs.map(d => d.id).sort();
              const contentStr = selectedDocs.map(d => `--- DOCUMENT: ${d.name} ---\n\n` + flattenChapters(d.chapters).map((c: any) => `${c.title}:\n${c.content}`).join('\n\n')).join('\n\n\n');
              
              activeChapter = {
                id: `lib_${sortedIds.join('_')}`,
                chapterNumber: 0,
                title: `Library Synthesis (${selectedDocs.length} Docs)`,
                summary: `Cross-document context established. Comparing: ${selectedDocs.map(d => d.name).join(' • ')}. Ask questions to compare, contrast, and synthesize knowledge across these sources.`,
                content: contentStr
              };
            }

            if (selectedChapterId === 'read_all' && selectedDoc) {
              return <DocumentReader document={selectedDoc} />;
            }

            let hasPrevChapter = false;
            let hasNextChapter = false;
            let onNavigateChapter = undefined;

            if (selectedDoc && activeChapter && activeChapter.id !== `lib_${Array.from(librarySelection).sort().join('_')}`) {
              const flatChaptersList = flattenChapters(selectedDoc.chapters);
              const currentIndex = flatChaptersList.findIndex(c => c.id === activeChapter.id);
              if (currentIndex > 0) hasPrevChapter = true;
              if (currentIndex >= 0 && currentIndex < flatChaptersList.length - 1) hasNextChapter = true;
              
              onNavigateChapter = (direction: 'prev' | 'next') => {
                if (direction === 'prev' && hasPrevChapter) {
                  setSelectedChapterId(flatChaptersList[currentIndex - 1].id);
                } else if (direction === 'next' && hasNextChapter) {
                  setSelectedChapterId(flatChaptersList[currentIndex + 1].id);
                }
              };
            }

            return activeChapter ? (
              <ChatArea 
                chapter={activeChapter}
                documentId={selectedDoc?.id}
                onClearChats={() => {
                  if (isLibraryChatActive) {
                    // Do nothing for virtual chats
                  } else if (selectedDocId) {
                    handleClearChats(selectedDocId);
                  }
                }}
                persona={persona}
                hasNextChapter={hasNextChapter}
                hasPrevChapter={hasPrevChapter}
                onNavigateChapter={onNavigateChapter}
                isStudent={isStudent}
              />
            ) : (
            <div 
              {...getEmptyRootProps()}
              className={cn(
                "flex-1 flex flex-col items-center justify-center text-white/40 p-6 md:p-8 text-center relative overflow-hidden transition-colors duration-300",
                isEmptyDragActive ? "bg-cyan-900/20" : ""
              )}
            >
              <input {...getEmptyInputProps()} />
              {/* Abstract Background Glow */}
              <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
                <div className="w-[20rem] h-[20rem] md:w-[40rem] md:h-[40rem] bg-cyan-900/10 rounded-full blur-[60px] md:blur-[100px]" />
              </div>
              
              <div className="relative z-10 flex flex-col items-center max-w-lg w-full">
                <div className={cn(
                  "w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 shadow-2xl transition-transform duration-500",
                  isEmptyDragActive ? "scale-110 border-cyan-500/50 bg-cyan-500/10 text-cyan-400" : "text-cyan-400/50"
                )}>
                  <UploadCloud className="w-10 h-10 md:w-12 md:h-12" />
                </div>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
                  {isEmptyDragActive ? "Drop document here" : `Welcome, ${user.name}`}
                </h2>
                {isStudent ? (
                  <p className="text-base md:text-lg font-light text-white/60 leading-relaxed mb-10 text-center">
                    You have view-only access. Select a shared document from the sidebar to start reading.
                  </p>
                ) : (
                  <>
                    <p className="text-base md:text-lg font-light text-white/60 leading-relaxed mb-10 text-center">
                      Upload your first document to automatically detect chapters, generate summaries, and interact with the text using AI.
                    </p>
                    
                    <button 
                      disabled={isOffline || isUploading}
                      className={cn("px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl font-semibold text-lg transition-all duration-300 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] hover:-translate-y-1 flex items-center gap-3", (isOffline || isUploading) && "opacity-50 cursor-not-allowed hover:translate-y-0")}
                    >
                      <UploadCloud className="w-5 h-5" />
                      {isOffline ? 'Upload Unavailable Offline' : 'Upload a Document'}
                    </button>
    
                    <div className="flex flex-wrap justify-center gap-2 mt-8">
                      {['PDF', 'EPUB', 'DOCX', 'TXT', 'Images'].map(ext => (
                        <span key={ext} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs font-medium">
                          {ext}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

