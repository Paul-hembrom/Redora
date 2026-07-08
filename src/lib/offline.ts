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
  topic_chats: {
    key: string; // chapterId
    value: {
      id: string;
      messages: any[];
      timestamp: number;
    };
  };
  topic_videos: {
    key: string; // chapterId
    value: {
      id: string;
      videos: any[];
      timestamp: number;
    };
  };
  topic_images: {
    key: string; // chapterId
    value: {
      id: string;
      images: any[];
      timestamp: number;
    };
  };
  tts_cache: {
    key: string; // text hash
    value: {
      id: string;
      audioUrl: string;
      timestamp: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<ReadoraDB>> | null = null;

if (typeof window !== 'undefined') {
  dbPromise = openDB<ReadoraDB>('readora-offline-db', 3, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('user', { keyPath: 'id' });
        db.createObjectStore('documents', { keyPath: 'id' });
        db.createObjectStore('chapters', { keyPath: 'id' });
        db.createObjectStore('media', { keyPath: 'url' });
      }
      if (oldVersion < 2) {
        db.createObjectStore('topic_chats', { keyPath: 'id' });
        db.createObjectStore('topic_videos', { keyPath: 'id' });
        db.createObjectStore('topic_images', { keyPath: 'id' });
      }
      if (oldVersion < 3) {
        db.createObjectStore('tts_cache', { keyPath: 'id' });
      }
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

export async function cacheDocuments(docs: any[]) {
  if (!dbPromise) return;
  const db = await dbPromise;
  for (const doc of docs) {
    await db.put('documents', { id: doc.id, doc, chapters: doc.chapters || [], timestamp: Date.now() });
    for (const ch of (doc.chapters || [])) {
       await db.put('chapters', { id: ch.id, chapter: ch, timestamp: Date.now() });
    }
  }
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

export async function cacheTopicChats(chapterId: string, messages: any[]) {
    if (!dbPromise) return;
    const db = await dbPromise;
    await db.put('topic_chats', { id: chapterId, messages, timestamp: Date.now() });
}

export async function getCachedTopicChats(chapterId: string) {
    if (!dbPromise) return null;
    const db = await dbPromise;
    const entry = await db.get('topic_chats', chapterId);
    return entry ? entry.messages : null;
}

export async function cacheTopicVideos(chapterId: string, videos: any[]) {
    if (!dbPromise) return;
    const db = await dbPromise;
    await db.put('topic_videos', { id: chapterId, videos, timestamp: Date.now() });
}

export async function getCachedTopicVideos(chapterId: string) {
    if (!dbPromise) return null;
    const db = await dbPromise;
    const entry = await db.get('topic_videos', chapterId);
    return entry ? entry.videos : null;
}

export async function cacheTopicImages(chapterId: string, images: any[]) {
    if (!dbPromise) return;
    const db = await dbPromise;
    await db.put('topic_images', { id: chapterId, images, timestamp: Date.now() });
}

export async function getCachedTopicImages(chapterId: string) {
    if (!dbPromise) return null;
    const db = await dbPromise;
    const entry = await db.get('topic_images', chapterId);
    return entry ? entry.images : null;
}

export async function generateTextHash(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function cacheTtsAudio(text: string, audioUrl: string) {
  if (!dbPromise) return;
  try {
    const id = await generateTextHash(text);
    const db = await dbPromise;
    await db.put('tts_cache', { id, audioUrl, timestamp: Date.now() });
  } catch (e) {
    console.error('Failed to cache TTS audio:', e);
  }
}

export async function getCachedTtsAudio(text: string) {
  if (!dbPromise) return null;
  try {
    const id = await generateTextHash(text);
    const db = await dbPromise;
    const entry = await db.get('tts_cache', id);
    return entry ? entry.audioUrl : null;
  } catch (e) {
    console.error('Failed to get cached TTS audio:', e);
    return null;
  }
}
