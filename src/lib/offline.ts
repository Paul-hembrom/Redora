import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ReadoraDB extends DBSchema {
  user: {
    key: string;
    value: {
      id: string;
      user: any; // User object
      timestamp: number;
    };
  };
  documents: {
    key: string; // docId
    value: {
      id: string;
      doc: any;
      chapters: any[];
      timestamp: number;
    };
  };
  chapters: {
    key: string; // chapterId
    value: {
      id: string;
      chapter: any;
      timestamp: number;
    };
  };
  media: {
    key: string; // url
    value: {
      url: string;
      blob: Blob;
      timestamp: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<ReadoraDB>> | null = null;

if (typeof window !== 'undefined') {
  dbPromise = openDB<ReadoraDB>('readora-offline-db', 1, {
    upgrade(db) {
      db.createObjectStore('user', { keyPath: 'id' });
      db.createObjectStore('documents', { keyPath: 'id' });
      db.createObjectStore('chapters', { keyPath: 'id' });
      db.createObjectStore('media', { keyPath: 'url' });
    },
  });
}

export async function cacheUser(user: any) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('user', { id: 'current', user, timestamp: Date.now() });
}

export async function getCachedUser() {
  if (!dbPromise) return null;
  const db = await dbPromise;
  const entry = await db.get('user', 'current');
  return entry ? entry.user : null;
}

export async function clearCachedUser() {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.delete('user', 'current');
}

export async function cacheDocument(doc: any, chapters: any[]) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('documents', { id: doc.id, doc, chapters, timestamp: Date.now() });
  
  // also cache individual chapters for easy access
  for (const ch of chapters) {
    await db.put('chapters', { id: ch.id, chapter: ch, timestamp: Date.now() });
  }
}

export async function getCachedDocuments() {
  if (!dbPromise) return [];
  const db = await dbPromise;
  const all = await db.getAll('documents');
  return all.map(a => a.doc);
}

export async function getCachedDocumentDetails(docId: string) {
  if (!dbPromise) return null;
  const db = await dbPromise;
  const entry = await db.get('documents', docId);
  return entry ? { doc: entry.doc, chapters: entry.chapters } : null;
}

export async function cacheMedia(url: string, blob: Blob) {
  if (!dbPromise || !url.startsWith('http')) return;
  const db = await dbPromise;
  await db.put('media', { url, blob, timestamp: Date.now() });
}

export async function getCachedMedia(url: string) {
  if (!dbPromise) return null;
  const db = await dbPromise;
  const entry = await db.get('media', url);
  return entry ? entry.blob : null;
}

export async function cacheWholeTopic(chapter: any) {
    if (!dbPromise) return;
    const db = await dbPromise;
    await db.put('chapters', { id: chapter.id, chapter, timestamp: Date.now() });
}

export async function getCachedChapter(chapterId: string) {
    if (!dbPromise) return null;
    const db = await dbPromise;
    const entry = await db.get('chapters', chapterId);
    return entry ? entry.chapter : null;    
}
