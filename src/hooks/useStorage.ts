import { useState, useEffect } from 'react';
import { Song, Block, Setlist, AppSettings } from '../types';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc,
  writeBatch,
  getDocs,
  query, 
  orderBy, 
  getDocFromServer,
  CollectionReference,
  DocumentReference,
  getDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getInitialSongs } from '../lib/initialSongs';

const DEFAULT_SETTINGS: AppSettings = {
  repertoireLink: '',
  presentationBackground: '#000000',
  presentationTextColor: '#ffffff',
  presentationFontSize: 40,
  autoScroll: false,
  scrollSpeed: 5,
  slideHeightCm: 15,
  presentationFontFamily: 'Inter, sans-serif',
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function cleanUndefined<T extends object>(obj: T): T {
  const result = { ...obj } as any;
  Object.keys(result).forEach(key => {
    if (result[key] === undefined) {
      delete result[key];
    }
  });
  return result;
}

export function useStorage() {
  const [songs, setSongsState] = useState<Song[]>([]);
  const [blocks, setBlocksState] = useState<Block[]>([]);
  const [setlists, setSetlistsState] = useState<Setlist[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Auth observer
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
      }
    }, (error) => {
      console.error("Auth state change error:", error);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Real-time synchronization
  useEffect(() => {
    if (!user) {
      setSongsState([]);
      setBlocksState([]);
      setSetlistsState([]);
      setSettingsState(DEFAULT_SETTINGS);
      // loading is already false or will be set by auth observer
      return;
    }

    setLoading(true);

    const userRef = doc(db, 'users', user.uid);
    const songsCol = collection(userRef, 'songs');
    const blocksCol = collection(userRef, 'blocks');
    const setlistsCol = collection(userRef, 'setlists');
    const settingsDoc = doc(userRef, 'settings', 'global');

    let songsLoaded = false;
    let blocksLoaded = false;
    let setlistsLoaded = false;
    let settingsLoaded = false;

    const checkAllLoaded = () => {
      if (songsLoaded && blocksLoaded && setlistsLoaded && settingsLoaded) {
        setLoading(false);
      }
    };

    const unsubSongs = onSnapshot(songsCol, async (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Song);
      
      // Seed initial songs if empty for a new user
      if (data.length === 0 && !songsLoaded) {
        const initialSongs = getInitialSongs();
        try {
          const batch = writeBatch(db);
          initialSongs.forEach(song => {
            const songRef = doc(db, 'users', user.uid, 'songs', song.id);
            batch.set(songRef, song);
          });
          await batch.commit();
          // The snapshot will fire again with the new data
        } catch (error) {
          console.error("Error seeding songs:", error);
        }
      } else {
        setSongsState(data);
      }
      
      songsLoaded = true;
      checkAllLoaded();
    }, (error) => {
      console.error('Firestore Songs Error: ', error);
      songsLoaded = true;
      checkAllLoaded();
    });

    const unsubBlocks = onSnapshot(blocksCol, (snapshot) => {
      setBlocksState(snapshot.docs.map(doc => doc.data() as Block));
      blocksLoaded = true;
      checkAllLoaded();
    }, (error) => {
      console.error('Firestore Blocks Error: ', error);
      blocksLoaded = true;
      checkAllLoaded();
    });

    const unsubSetlists = onSnapshot(query(setlistsCol, orderBy('createdAt', 'desc')), (snapshot) => {
      setSetlistsState(snapshot.docs.map(doc => doc.data() as Setlist));
      setlistsLoaded = true;
      checkAllLoaded();
    }, (error) => {
      console.error('Firestore Setlists Error: ', error);
      setlistsLoaded = true;
      checkAllLoaded();
    });

    const unsubSettings = onSnapshot(settingsDoc, (doc) => {
      if (doc.exists()) {
        setSettingsState({ ...DEFAULT_SETTINGS, ...doc.data() as AppSettings });
      }
      settingsLoaded = true;
      checkAllLoaded();
    }, (error) => {
      console.error('Firestore Settings Error: ', error);
      settingsLoaded = true;
      checkAllLoaded();
    });

    // Timeout safety for loading
    const timeoutId = setTimeout(() => {
      if (loading) setLoading(false);
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
      unsubSongs();
      unsubBlocks();
      unsubSetlists();
      unsubSettings();
    };
  }, [user]);

  const saveSong = async (song: Song) => {
    if (!user) return;
    
    // Optimistic local update
    setSongsState(prev => {
      const idx = prev.findIndex(s => s.id === song.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = song;
        return updated;
      }
      return [...prev, song];
    });

    try {
      const songRef = doc(db, 'users', user.uid, 'songs', song.id);
      await setDoc(songRef, cleanUndefined(song), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/songs/${song.id}`);
    }
  };

  const deleteSong = async (id: string) => {
    if (!user) return;
    
    setSongsState(prev => prev.filter(s => s.id !== id));
    
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'songs', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/songs/${id}`);
    }
  };

  const saveBlock = async (block: Block) => {
    if (!user) return;
    
    setBlocksState(prev => {
      const idx = prev.findIndex(b => b.id === block.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = block;
        return updated;
      }
      return [...prev, block];
    });

    try {
      const blockRef = doc(db, 'users', user.uid, 'blocks', block.id);
      await setDoc(blockRef, cleanUndefined(block));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/blocks/${block.id}`);
    }
  };

  const deleteBlock = async (id: string) => {
    if (!user) return;
    
    setBlocksState(prev => prev.filter(b => b.id !== id));
    
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'blocks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/blocks/${id}`);
    }
  };

  const saveSetlist = async (setlist: Setlist) => {
    if (!user) return;

    setSetlistsState(prev => {
      const idx = prev.findIndex(s => s.id === setlist.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = setlist;
        return updated;
      }
      return [setlist, ...prev]; // New setlists at the top
    });

    try {
      const setlistRef = doc(db, 'users', user.uid, 'setlists', setlist.id);
      await setDoc(setlistRef, cleanUndefined(setlist));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/setlists/${setlist.id}`);
    }
  };

  const deleteSetlist = async (id: string) => {
    if (!user) return;
    
    setSetlistsState(prev => prev.filter(s => s.id !== id));
    
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'setlists', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/setlists/${id}`);
    }
  };

  const setSongs = async (newSongs: Song[]) => {
    if (!user) return;
    
    // Chunk the array into batches of at most 200 items each to prevent the 500 operations Firestore limit
    try {
      const chunkSize = 200;
      for (let i = 0; i < newSongs.length; i += chunkSize) {
        const chunk = newSongs.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const song of chunk) {
          const songRef = doc(db, 'users', user.uid, 'songs', song.id);
          batch.set(songRef, cleanUndefined(song), { merge: true });
        }
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/songs/batch`);
    }
  };

  const setBlocks = async (newBlocks: Block[]) => {
    if (!user) return;
    
    try {
      const chunkSize = 200;
      for (let i = 0; i < newBlocks.length; i += chunkSize) {
        const chunk = newBlocks.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const block of chunk) {
          const blockRef = doc(db, 'users', user.uid, 'blocks', block.id);
          batch.set(blockRef, cleanUndefined(block));
        }
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/blocks/batch`);
    }
  };

  const setSetlists = async (newSetlists: Setlist[]) => {
    if (!user) return;

    try {
      const chunkSize = 200;
      for (let i = 0; i < newSetlists.length; i += chunkSize) {
        const chunk = newSetlists.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const setlist of chunk) {
          const setlistRef = doc(db, 'users', user.uid, 'setlists', setlist.id);
          batch.set(setlistRef, cleanUndefined(setlist));
        }
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/setlists/batch`);
    }
  };

  const setSettings = async (newSettings: AppSettings) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'global'), cleanUndefined(newSettings));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/settings/global`);
    }
  };

  const clearBlocksAndSetlists = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const blocksCol = collection(userRef, 'blocks');
      const setlistsCol = collection(userRef, 'setlists');

      const blocksSnap = await getDocs(blocksCol);
      const setlistsSnap = await getDocs(setlistsCol);

      const batch = writeBatch(db);

      blocksSnap.forEach((doc) => {
        batch.delete(doc.ref);
      });

      setlistsSnap.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/reset`);
    }
  };

  const triggerManualSync = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const songsCol = collection(userRef, 'songs');
      const blocksCol = collection(userRef, 'blocks');
      const setlistsCol = collection(userRef, 'setlists');
      const settingsDoc = doc(userRef, 'settings', 'global');

      const [songsSnap, blocksSnap, setlistsSnap, settingsSnap] = await Promise.all([
        getDocs(songsCol),
        getDocs(blocksCol),
        getDocs(setlistsCol),
        getDoc(settingsDoc)
      ]);

      const freshSongs = songsSnap.docs.map(doc => doc.data() as Song);
      const freshBlocks = blocksSnap.docs.map(doc => doc.data() as Block);
      const freshSetlists = setlistsSnap.docs.map(doc => doc.data() as Setlist);

      if (freshSongs.length > 0) {
        setSongsState(freshSongs);
      }
      setBlocksState(freshBlocks);
      setSetlistsState(freshSetlists);
      if (settingsSnap.exists()) {
        setSettingsState({ ...DEFAULT_SETTINGS, ...settingsSnap.data() as AppSettings });
      }

      const now = new Date();
      setLastSyncTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      return true;
    } catch (error) {
      console.error("Error performing manual sync:", error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    songs,
    saveSong,
    deleteSong,
    setSongs,
    blocks,
    saveBlock,
    deleteBlock,
    setBlocks,
    setlists,
    saveSetlist,
    deleteSetlist,
    setSetlists,
    settings,
    setSettings,
    clearBlocksAndSetlists,
    loading,
    user,
    isSyncing,
    lastSyncTime,
    triggerManualSync
  };
}
