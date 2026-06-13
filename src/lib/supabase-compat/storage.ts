export function getStorage(app?: any) {
  return { name: '[Supabase Firebase-Compat Storage]' };
}

export class StorageReference {
  constructor(public fullPath: string) {}
}

export function ref(storageInstance: any, path: string) {
  return new StorageReference(path);
}

export async function uploadBytes(storageRef: StorageReference, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', storageRef.fullPath);

  const res = await fetch('/api/storage/upload', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    throw new Error('Submitting file failed');
  }

  const data = await res.json();
  return {
    ref: new StorageReference(data.path),
    downloadUrl: data.downloadUrl
  };
}

export async function getDownloadURL(storageRef: StorageReference) {
  return `/api/storage/file?path=${encodeURIComponent(storageRef.fullPath)}`;
}
