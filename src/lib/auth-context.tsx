import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Profile } from './types';

interface LocalUser {
  id: string;
  email: string;
  profile_id: string;
}

interface LocalSession {
  user: LocalUser;
}

interface AuthContextType {
  user: LocalUser | null;
  profile: Profile | null;
  session: LocalSession | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, role: 'admin' | 'driver') => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const LOCAL_USER_KEY = 'frota_local_user_id';
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<LocalSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getInitialSession = async () => {
      const userId = localStorage.getItem(LOCAL_USER_KEY);
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const result = await apiAuth<{ user: LocalUser | null; profile: Profile | null }>(`/session?userId=${encodeURIComponent(userId)}`);
        setUser(result.user);
        setProfile(result.profile);
        setSession(result.user ? { user: result.user } : null);

        if (!result.user) {
          localStorage.removeItem(LOCAL_USER_KEY);
        }
      } catch (error) {
        console.error('Error getting local session:', error);
        localStorage.removeItem(LOCAL_USER_KEY);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();
  }, []);

  const signUp = async (email: string, password: string, name: string, role: 'admin' | 'driver') => {
    try {
      await apiAuth('/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, role }),
      });

      return {};
    } catch (err) {
      console.error('SignUp error:', err);
      return { error: err instanceof Error ? err.message : 'Erro inesperado ao criar conta' };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await apiAuth<{ user: LocalUser; profile: Profile }>('/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem(LOCAL_USER_KEY, result.user.id);
      setUser(result.user);
      setProfile(result.profile);
      setSession({ user: result.user });
      return {};
    } catch (err) {
      console.error('SignIn error:', err);
      return { error: err instanceof Error ? err.message : 'Erro ao fazer login' };
    }
  };

  const signOut = async () => {
    localStorage.removeItem(LOCAL_USER_KEY);
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

async function apiAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/auth${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'Erro na autenticacao local');
  }

  return data as T;
}
