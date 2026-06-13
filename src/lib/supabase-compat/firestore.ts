export function getFirestore(app?: any, dbId?: string) {
  return { type: 'firestore-emulator' };
}

export class CollectionReference {
  constructor(public path: string) {}
}

export class DocumentReference {
  constructor(public path: string, public id: string) {}
}

export function collection(db: any, path: string, ...subPaths: string[]) {
  const fullPath = [path, ...subPaths].join('/');
  return new CollectionReference(fullPath);
}

export function doc(db: any, path: string, ...subPaths: string[]) {
  const parts = [path, ...subPaths];
  const docId = parts.pop() || '';
  const collectionPath = parts.join('/');
  return new DocumentReference(collectionPath, docId);
}

export function query(colRef: CollectionReference, ...queryConstraints: any[]) {
  return {
    path: colRef.path,
    constraints: queryConstraints
  };
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction?: 'asc' | 'desc') {
  return { type: 'orderBy', field, direction };
}

// REST database helper to query our server endpoint
async function fetchCollectionDocs(path: string, constraints?: any[]): Promise<any[]> {
  try {
    const qStr = constraints ? encodeURIComponent(JSON.stringify(constraints)) : '';
    const res = await fetch(`/api/db/query?path=${encodeURIComponent(path)}&constraints=${qStr}`);
    if (res.ok) {
      const data = await res.json();
      return data.list || [];
    }
  } catch (e) {
    console.error(`fetchCollectionDocs error on path ${path}:`, e);
  }
  return [];
}

export function onSnapshot(target: any, onNext: (snap: any) => void, onError?: (err: any) => void) {
  const path = target.path;
  const constraints = target.constraints;

  let active = true;
  const poll = async () => {
    if (!active) return;
    const docs = await fetchCollectionDocs(path, constraints);
    
    const snap = {
      empty: docs.length === 0,
      forEach: (callback: (docSnap: any) => void) => {
        docs.forEach((item: any) => {
          callback({
            id: item.id || item.uid || '',
            data: () => item
          });
        });
      },
      docs: docs.map((item: any) => ({
        id: item.id || item.uid || '',
        data: () => item
      }))
    };
    
    if (active) {
      onNext(snap);
    }
  };

  // Run immediately
  poll();

  // Poll for UI reactive sync in mock client adapter block
  const intervalId = setInterval(poll, 3000);

  return () => {
    active = false;
    clearInterval(intervalId);
  };
}

export async function getDocs(target: any) {
  const docs = await fetchCollectionDocs(target.path, target.constraints);
  return {
    empty: docs.length === 0,
    forEach: (callback: (docSnap: any) => void) => {
      docs.forEach((item: any) => {
        callback({
          id: item.id || item.uid || '',
          data: () => item
        });
      });
    },
    docs: docs.map((item: any) => ({
      id: item.id || item.uid || '',
      data: () => item
    }))
  };
}

export async function getDoc(docRef: DocumentReference) {
  try {
    const res = await fetch(`/api/db/get?path=${encodeURIComponent(docRef.path)}&id=${encodeURIComponent(docRef.id)}`);
    if (res.ok) {
      const payload = await res.json();
      return {
        exists: () => payload.exists,
        data: () => payload.data
      };
    }
  } catch (e) {
    console.error(e);
  }
  return {
    exists: () => false,
    data: () => null
  };
}

export async function setDoc(docRef: DocumentReference, data: any, options?: { merge?: boolean }) {
  const url = `/api/db/set`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: docRef.path,
      id: docRef.id,
      data,
      merge: options?.merge !== false
    })
  });
  if (!res.ok) {
    throw new Error('Failed to set document');
  }
  return {};
}

export async function updateDoc(docRef: DocumentReference, data: any) {
  return setDoc(docRef, data, { merge: true });
}

export async function addDoc(colRef: CollectionReference, data: any) {
  const generatedId = Math.random().toString(36).substring(2, 15);
  const url = `/api/db/set`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: colRef.path,
      id: generatedId,
      data: { ...data, id: generatedId }
    })
  });
  if (!res.ok) {
    throw new Error('Failed to add document');
  }
  return { id: generatedId };
}

export async function deleteDoc(docRef: DocumentReference) {
  const res = await fetch(`/api/db/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: docRef.path,
      id: docRef.id
    })
  });
  if (!res.ok) {
    throw new Error('Failed to delete document');
  }
  return {};
}

export function writeBatch(db: any) {
  return {
    set: (docRef: DocumentReference, data: any, options?: any) => {
      setDoc(docRef, data, options);
    },
    commit: async () => {
      // Completed in emulated call
    }
  };
}
