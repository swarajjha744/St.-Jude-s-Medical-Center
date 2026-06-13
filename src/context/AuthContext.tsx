import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebasesignOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  profile: UserProfile | null;
  loading: boolean;
  registerPatient: (email: string, password: string, name: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      const email = userSnap.exists() ? (userSnap.data().email) : (auth.currentUser?.email || '');
      const isAdminEmail = email === 'swarajjha744@gmail.com';

      if (userSnap.exists()) {
        const fullProfile = userSnap.data() as UserProfile;
        if (isAdminEmail && fullProfile.role !== 'admin') {
          fullProfile.role = 'admin';
          await setDoc(userRef, { role: 'admin' }, { merge: true });
        }
        setProfile(fullProfile);
        setRole(fullProfile.role);
      } else {
        if (isAdminEmail && email) {
          const newAdminProfile: UserProfile = {
            uid,
            name: email.split('@')[0] || 'Admin',
            email,
            role: 'admin',
            phone: '',
            address: '',
            DOB: '',
            bloodGroup: '',
            emergencyContact: ''
          };
          await setDoc(userRef, newAdminProfile, { merge: true });
          setProfile(newAdminProfile);
          setRole('admin');
        } else {
          setProfile(null);
          setRole(null);
        }
      }
    } catch (err) {
      console.error('Error fetching patient user profile:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(user.uid);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadUserProfile(currentUser.uid);
      } else {
        setRole(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const registerPatient = async (email: string, password: string, name: string) => {
    setLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user profile in Firestore
      const userRef = doc(db, 'users', userCred.user.uid);
      const newProfile: UserProfile = {
        uid: userCred.user.uid,
        name,
        email,
        role: 'patient',
        phone: '',
        address: '',
        DOB: '',
        bloodGroup: '',
        emergencyContact: ''
      };
      await setDoc(userRef, newProfile);
      
      setUser(userCred.user);
      await loadUserProfile(userCred.user.uid);
    } catch (error: any) {
      console.error('Registration failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      setUser(userCred.user);
      await loadUserProfile(userCred.user.uid);
    } catch (error: any) {
      console.error('Login credentials check failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      
      // Check/create user profile in Firestore if it doesn't exist
      const userRef = doc(db, 'users', userCred.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const newProfile: UserProfile = {
          uid: userCred.user.uid,
          name: userCred.user.displayName || userCred.user.email?.split('@')[0] || 'User',
          email: userCred.user.email || '',
          role: userCred.user.email === 'swarajjha744@gmail.com' ? 'admin' : 'patient',
          phone: '',
          address: '',
          DOB: '',
          bloodGroup: '',
          emergencyContact: ''
        };
        await setDoc(userRef, newProfile);
      }
      
      setUser(userCred.user);
      await loadUserProfile(userCred.user.uid);
    } catch (error) {
      console.error('Google Sign-In failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await firebasesignOut(auth);
      setRole(null);
      setProfile(null);
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = loginWithEmail;
  const signup = async (email: string, password: string, name: string, role?: string) => {
    await registerPatient(email, password, name);
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      profile,
      loading,
      registerPatient,
      loginWithEmail,
      loginWithGoogle,
      logout,
      refreshProfile,
      login,
      signup
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be defined inside an AuthProvider');
  }
  return context;
}
