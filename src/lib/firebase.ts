import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// User's custom production Firebase config (persisted for exports/production builds)
export const USER_PRODUCTION_CONFIG = {
  projectId: "st-jude-s-medical-center",
  appId: "1:794381068716:web:25f270cbb149e824c5f209",
  apiKey: "AIzaSyBHcJKoLVAJrX1STBFcUdN4O3gzgM-xkRI",
  authDomain: "st-jude-s-medical-center.firebaseapp.com",
  firestoreDatabaseId: "(default)",
  storageBucket: "st-jude-s-medical-center.firebasestorage.app",
  messagingSenderId: "794381068716",
  measurementId: ""
};

// Check if running inside Google AI Studio preview or local dev sandbox
const isSandbox = typeof window !== 'undefined' && (
  window.location.hostname.includes('run.app') || 
  window.location.hostname.includes('localhost') || 
  window.location.hostname.includes('127.0.0.1')
);

// Use sandbox config in dev/preview, and user config for standalone export / separate deployment.
const activeConfig = isSandbox ? firebaseConfig : USER_PRODUCTION_CONFIG;

const app = initializeApp(activeConfig);
export const auth = getAuth(app);

const dbId = activeConfig.firestoreDatabaseId && activeConfig.firestoreDatabaseId !== '(default)' 
  ? activeConfig.firestoreDatabaseId 
  : undefined;

export const db = getFirestore(app, dbId);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
