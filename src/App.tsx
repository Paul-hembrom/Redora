import React, { useState, useEffect } from 'react';
import { Document, PreprocessOptions, ChatMessage } from './types';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import Login from './components/Login';
import Signup from './components/Signup';
import { useAuth } from './contexts/AuthContext';
import { processDocument } from './lib/documentProcessor';
import { generateChatResponse } from './lib/gemini';
import { v4 as uuidv4 } from 'uuid';
import { BookOpen, LogOut, User as UserIcon } from 'lucide-react';

export default function App() {
  const { user, loading, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(true);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

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

  useEffect(() => {
    if (user && selectedChapterId && !chats[selectedChapterId]) {
      fetch(`/api/chats/${selectedChapterId}`)
        .then(res => {
          if (res.status === 401) {
            logout();
            throw new Error('Unauthorized');
          }
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            setChats(prev => ({ ...prev, [selectedChapterId]: data }));
          } else {
            console.error('Failed to fetch chats:', data);
          }
        })
        .catch(err => console.error('Failed to fetch chats', err));
    }
  }, [user, selectedChapterId, logout, chats]);

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-emerald-500">Loading...</div>;
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
    setChatError(null);
  };

  const handleSendMessage = async (text: string) => {
    if (!selectedChapterId || !selectedDocId) return;
    
    const doc = documents.find(d => d.id === selectedDocId);
    const chapter = doc?.chapters.find(c => c.id === selectedChapterId);
    if (!chapter) return;

    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', text };
    
    setChats(prev => ({
      ...prev,
      [selectedChapterId]: [...(prev[selectedChapterId] || []), userMsg]
    }));

    // Save user message to DB
    fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...userMsg, chapterId: selectedChapterId })
    }).catch(console.error);

    setIsTyping(true);
    setChatError(null);

    try {
      const history = chats[selectedChapterId] || [];
      const aiResult = await generateChatResponse(text, chapter.content, history);
      
      const aiMsg: ChatMessage = {
        id: uuidv4(),
        role: 'model',
        text: aiResult.response,
        relationshipGraph: aiResult.relationshipGraph,
        followUps: aiResult.followUpQuestions
      };

      setChats(prev => ({
        ...prev,
        [selectedChapterId]: [...(prev[selectedChapterId] || []), aiMsg]
      }));

      // Save AI message to DB
      fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...aiMsg, chapterId: selectedChapterId })
      }).catch(console.error);

    } catch (err: any) {
      console.error(err);
      setChatError(err.message || 'Failed to generate response.');
    } finally {
      setIsTyping(false);
    }
  };

  const selectedDoc = documents.find(d => d.id === selectedDocId);
  const selectedChapter = selectedDoc?.chapters.find(c => c.id === selectedChapterId);

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-neutral-200 font-sans overflow-hidden">
      {/* Top Navigation Header */}
      <header className="h-14 border-b border-neutral-800 bg-[#0f0f0f] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2 text-emerald-400">
          <BookOpen className="w-5 h-5" />
          <h1 className="font-semibold text-sm tracking-tight text-neutral-100">AI Book Reader</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <UserIcon className="w-4 h-4" />
            <span>{user.name}</span>
          </div>
          <button 
            onClick={logout}
            className="text-neutral-500 hover:text-red-400 transition-colors flex items-center gap-1 text-sm"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          documents={documents}
          selectedDocId={selectedDocId}
          selectedChapterId={selectedChapterId}
          onSelectChapter={handleSelectChapter}
          onUpload={handleUpload}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          uploadError={uploadError}
        />
        
        {selectedChapter ? (
          <ChatArea 
            chapter={selectedChapter}
            messages={chats[selectedChapter.id] || []}
            onSendMessage={handleSendMessage}
            isTyping={isTyping}
            error={chatError}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-600 p-8 text-center">
            <BookOpen className="w-16 h-16 mb-4 opacity-20" />
            <h2 className="text-xl font-semibold text-neutral-400 mb-2">Welcome, {user.name}</h2>
            <p className="max-w-md text-sm">
              Upload a document to automatically detect chapters, generate summaries, and interact with the text using a chapter-specific query engine.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

