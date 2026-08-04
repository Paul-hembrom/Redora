import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallbackText?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Workspace crash:', error, errorInfo);
    fetch('/api/log-client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: error.message, 
        stack: error.stack, 
        source: 'ErrorBoundary' 
      })
    }).catch(() => {});
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-white font-sans">
          <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
               <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold mb-3">{this.props.fallbackText || 'Something went wrong while loading your workspace.'}</h2>
            <div className="text-white/50 text-xs mb-8 break-words text-left max-h-32 overflow-y-auto w-full p-4 bg-black/50 border border-white/5 rounded-lg font-mono">
              <p style={{ color: 'red', marginTop: '1rem', whiteSpace: 'pre-wrap', textAlign: 'left' }}>{this.state.error?.message}</p>
              <p style={{ color: '#ffaaaa', marginTop: '0.5rem', fontSize: '10px', whiteSpace: 'pre-wrap', textAlign: 'left' }}>{this.state.error?.stack}</p>
            </div>
            <div className="flex gap-3 w-full">
               <button 
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
               >
                  <RefreshCw className="w-4 h-4" />
                  Retry
               </button>
               <button 
                  onClick={() => {
                     document.cookie.split(";").forEach((c) => {
                        document.cookie = c
                           .replace(/^ +/, "")
                           .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                     });
                     window.location.reload();
                  }}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
               >
                  <Trash2 className="w-4 h-4" />
                  Clear & Reload
               </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
