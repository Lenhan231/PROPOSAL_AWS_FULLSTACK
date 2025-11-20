import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import * as auth from '../lib/auth';
import { setTokenGetter } from '../lib/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  // Set token getter for API client
  useEffect(() => {
    setTokenGetter(auth.getAccessToken);
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await auth.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Failed to load user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    const user = await auth.signIn(email, password);
    setUser(user);
    return user;
  };

  const signUp = async (data) => {
    const result = await auth.signUp(data);
    return result;
  };

  const signOut = async () => {
    await auth.signOut();
    setUser(null);
    router.push('/login');
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user ? auth.isAdmin(user) : false,
    signIn,
    signUp,
    signOut,
    refreshUser: loadUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
