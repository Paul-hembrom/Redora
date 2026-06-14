import React, { createContext, useContext, useState, useEffect } from 'react';
import { cacheUser, getCachedUser, clearCachedUser } from '../lib/offline';

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  token?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isOffline: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkAuth = async () => {
      try {
        if (!navigator.onLine) {
          throw new Error('Offline');
        }
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) throw new Error('Unauthorized');
        const data = await res.json();
        
        if (data.user) {
          const authUser = { ...data.user, token: data.token };
          setUser(authUser);
          await cacheUser({ ...data.user, token: data.token });
        } else {
          await clearCachedUser();
        }
      } catch (err: any) {
        if (err.message === 'Offline' || !navigator.onLine) {
           const cached = await getCachedUser();
           if (cached) {
               // Check expiry if it's a JWT optionally, but for simplicity if we are offline and have a cached user, we restore it.
               setUser(cached);
           }
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const login = async (userData: User) => {
    setUser(userData);
    await cacheUser(userData);
  };
  
  const logout = async () => {
    if (navigator.onLine) {
      await fetch('/api/auth/logout', { method: 'POST' });
    }
    await clearCachedUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isOffline, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

