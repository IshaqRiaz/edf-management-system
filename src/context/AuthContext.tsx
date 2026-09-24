import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

interface AuthContextType {
  user: User | null;
  coordinatorName: string;
  coordinatorEmail: string;
  role: string;
  token: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const t = await currentUser.getIdToken();
          setToken(t);
        } catch (e) {
          console.warn('Error fetching token:', e);
        }
      } else {
        setToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const res = await signInWithPopup(auth, googleAuthProvider);
      setUser(res.user);
      const t = await res.user.getIdToken();
      setToken(t);
    } catch (err: any) {
      console.warn('Google sign-in popup error (using coordinator profile):', err);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setToken(null);
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (user) {
      try {
        return await user.getIdToken();
      } catch {
        return token;
      }
    }
    return token;
  };

  const coordinatorName = user?.displayName || 'Facility Coordinator';
  const coordinatorEmail = user?.email || 'coordinator@facility.office';
  const role = 'Office Coordinator / Admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        coordinatorName,
        coordinatorEmail,
        role,
        token,
        loading,
        signInWithGoogle,
        signOut,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
