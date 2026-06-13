import { initializeApp } from './app';

export class GoogleAuthProvider {
  // Mock Google provider
}

export const auth = {
  currentUser: null as any,
  onAuthStateChangedListeners: [] as ((user: any) => void)[],
};

// Load the user session from localStorage if it exists on boot
if (typeof localStorage !== 'undefined') {
  const session = localStorage.getItem('supabase_emulated_session');
  if (session) {
    try {
      auth.currentUser = JSON.parse(session);
    } catch (e) {
      console.error('Failed reading native emulated session:', e);
    }
  }
}

export function getAuth(app?: any) {
  return auth;
}

export function onAuthStateChanged(authInstance: any, callback: (user: any) => void) {
  auth.onAuthStateChangedListeners.push(callback);
  // Call immediately with existing state
  setTimeout(() => {
    callback(auth.currentUser);
  }, 0);
  return () => {
    auth.onAuthStateChangedListeners = auth.onAuthStateChangedListeners.filter(l => l !== callback);
  };
}

function notifyStateChanged() {
  auth.onAuthStateChangedListeners.forEach(listener => {
    try {
      listener(auth.currentUser);
    } catch (e) {
      console.error(e);
    }
  });
}

export async function createUserWithEmailAndPassword(authInstance: any, email: string, password: string) {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: email.split('@')[0], role: 'patient' })
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Registration failed');
  }
  const data = await response.json();
  const mockUser = {
    uid: data.uid,
    email: data.email,
    displayName: data.name,
    getIdToken: async () => 'mock_token_' + data.uid,
    getIdTokenResult: async () => ({ claims: { role: data.role } })
  };
  auth.currentUser = mockUser;
  localStorage.setItem('supabase_emulated_session', JSON.stringify(mockUser));
  notifyStateChanged();
  return { user: mockUser };
}

export async function signInWithEmailAndPassword(authInstance: any, email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Login failed');
  }
  const data = await response.json();
  const mockUser = {
    uid: data.uid,
    email: data.email,
    displayName: data.name,
    getIdToken: async () => 'mock_token_' + data.uid,
    getIdTokenResult: async () => ({ claims: { role: data.role } })
  };
  auth.currentUser = mockUser;
  localStorage.setItem('supabase_emulated_session', JSON.stringify(mockUser));
  notifyStateChanged();
  return { user: mockUser };
}

export async function signInWithPopup(authInstance: any, provider: any) {
  const email = prompt("Enter email for Google-OAuth simulation:", "patient1@example.com") || "patient1@example.com";
  const name = email.split('@')[0];
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Hospital123!' }) // Default medical password
  });
  
  let data;
  if (response.ok) {
    data = await response.json();
  } else {
    // Attempt registration fallback
    const regResponse = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Hospital123!', name, role: 'patient' })
    });
    if (!regResponse.ok) {
      throw new Error('Google popup mock registration failed.');
    }
    data = await regResponse.json();
  }
  
  const mockUser = {
    uid: data.uid,
    email: data.email,
    displayName: data.name,
    getIdToken: async () => 'mock_token_' + data.uid,
    getIdTokenResult: async () => ({ claims: { role: data.role } })
  };
  auth.currentUser = mockUser;
  localStorage.setItem('supabase_emulated_session', JSON.stringify(mockUser));
  notifyStateChanged();
  return { user: mockUser };
}

export async function signOut(authInstance: any) {
  auth.currentUser = null;
  localStorage.removeItem('supabase_emulated_session');
  notifyStateChanged();
}

// Support alternative firebase import naming styles
export const firebasesignOut = signOut;
