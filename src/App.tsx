import React, { useState, useEffect } from 'react';
import { Document, PreprocessOptions, ChatMessage } from './types';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import Login from './components/Login';
import Signup from './components/Signup';
import GlobalSearchModal from './components/GlobalSearchModal';
import { useAuth } from './contexts/AuthContext';
import { processDocument } from './lib/documentProcessor';
import { generateChatResponse } from './lib/gemini';
import { v4 as uuidv4 } from 'uuid';
import { BookOpen, LogOut, User as UserIcon, Menu, X, Search } from 'lucide-react';

export default function App() {
  const { user, loading, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetch('/api/documents')
        .then(res => {
          if (res.status === 401) {
            logout();
            throw new Error('Unauthorized');
          }
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            setDocuments(data);
          } else {
            console.error('Failed to fetch documents:', data);
            setDocuments([]);
          }
        })
        .catch(err => console.error('Failed to fetch documents', err));
    }
  }, [user, logout]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)] mb-4">
          <BookOpen className="w-6 h-6 animate-pulse" />
        </div>
        <p className="text-white/40 font-display tracking-widest uppercase text-sm font-medium animate-pulse">Loading Readora</p>
      </div>
    );
  }

  if (!user) {
    return showLogin ? 
      <Login onSwitchToSignup={() => setShowLogin(false)} /> : 
      <Signup onSwitchToLogin={() => setShowLogin(true)} />;
  }

  const handleUpload = async (files: File[], options: PreprocessOptions) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      for (const file of files) {
        const chapters = await processDocument(file, options, setUploadProgress);
        const newDoc: Document = {
          id: uuidv4(),
          name: file.name,
          uploadDate: new Date().toISOString(),
          chapters
        };
        
        await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newDoc)
        });

        setDocuments(prev => [newDoc, ...prev]);
        
        if (!selectedDocId) {
          setSelectedDocId(newDoc.id);
          if (chapters.length > 0) {
            setSelectedChapterId(chapters[0].id);
          }
        }
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
    setIsSidebarOpen(false); // Close sidebar on mobile when a chapter is selected
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

  const selectedDoc = documents.find(d => d.id === selectedDocId);
  const selectedChapter = selectedDoc?.chapters.find(c => c.id === selectedChapterId);

  return (
    <div className="flex flex-col h-[100dvh] bg-[#050505] text-white font-sans overflow-hidden">
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
          <h1 className="font-display font-bold text-lg tracking-wide">READORA</h1>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
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
          setIsSidebarOpen(false);
        }}
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
            documents={documents}
            selectedDocId={selectedDocId}
            selectedChapterId={selectedChapterId}
            onSelectChapter={handleSelectChapter}
            onUpload={handleUpload}
            onDeleteDocument={handleDeleteDocument}
            onClearChats={handleClearChats}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            uploadError={uploadError}
          />
        </div>
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-0">
          {selectedChapter ? (
            <ChatArea 
              chapter={selectedChapter}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-white/40 p-6 md:p-8 text-center relative overflow-hidden">
              {/* Abstract Background Glow */}
              <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
                <div className="w-[20rem] h-[20rem] md:w-[40rem] md:h-[40rem] bg-cyan-900/10 rounded-full blur-[60px] md:blur-[100px]" />
              </div>
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-2xl">
                  <BookOpen className="w-8 h-8 md:w-10 md:h-10 text-cyan-400/50" />
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-semibold text-white mb-3">Welcome, {user.name}</h2>
                <p className="max-w-md text-sm md:text-base font-light text-white/50 leading-relaxed">
                  Upload a document to automatically detect chapters, generate summaries, and interact with the text using a chapter-specific query engine.
                </p>
                <button 
                  className="mt-8 md:hidden px-6 py-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl font-medium"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  Open Library
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

