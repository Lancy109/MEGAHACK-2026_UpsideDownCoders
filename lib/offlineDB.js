import { openDB } from 'idb';

const DB_NAME = 'resqnet-offline';
const DB_VERSION = 2;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Pending SOS queue (legacy)
      if (!db.objectStoreNames.contains('pending-sos')) {
        const sosStore = db.createObjectStore('pending-sos', { keyPath: 'tempId' });
        sosStore.createIndex('createdAt', 'createdAt');
      }
      // sos_queue — spec-compliant store with uploaded flag
      if (!db.objectStoreNames.contains('sos_queue')) {
        const qStore = db.createObjectStore('sos_queue', { keyPath: 'localId' });
        qStore.createIndex('uploaded', 'uploaded');
        qStore.createIndex('createdAt', 'createdAt');
      }
      // Cached SOS alerts for offline viewing
      if (!db.objectStoreNames.contains('cached-sos')) {
        db.createObjectStore('cached-sos', { keyPath: 'id' });
      }
      // Cached volunteer data
      if (!db.objectStoreNames.contains('cached-volunteers')) {
        db.createObjectStore('cached-volunteers', { keyPath: 'id' });
      }
      // Offline chat messages queue
      if (!db.objectStoreNames.contains('pending-messages')) {
        db.createObjectStore('pending-messages', { keyPath: 'tempId' });
      }
      // User profile cache
      if (!db.objectStoreNames.contains('user-profile')) {
        db.createObjectStore('user-profile', { keyPath: 'id' });
      }
    },
  });
}

// ── sos_queue helpers ──────────────────────────────────────────────────────

export async function enqueueSOSPacket(sosData) {
  const db = await getDB();
  const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const record = { ...sosData, localId, retryCount: 0, uploaded: false, createdAt: new Date().toISOString() };
  await db.put('sos_queue', record);
  return localId;
}

export async function getPendingCount() {
  const db = await getDB();
  const all = await db.getAllFromIndex('sos_queue', 'uploaded', false);
  return all.length;
}

export async function flushQueue(uploadFn, onProgress) {
  const db = await getDB();
  const pending = await db.getAllFromIndex('sos_queue', 'uploaded', false);
  let done = 0;
  for (const item of pending) {
    try {
      await uploadFn(item);
      await db.put('sos_queue', { ...item, uploaded: true });
    } catch {
      await db.put('sos_queue', { ...item, retryCount: (item.retryCount || 0) + 1 });
    }
    done++;
    if (typeof onProgress === 'function') onProgress(done, pending.length);
  }
}

export function registerOnlineFlush(uploadFn) {
  if (typeof window === 'undefined') return;
  const handler = async () => {
    await flushQueue(uploadFn, null);
    window.dispatchEvent(new CustomEvent('resqnet:flushed'));
  };
  window.addEventListener('online', handler);
  window.addEventListener('resqnet:online', handler);
  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('resqnet:online', handler);
  };
}

export async function savePendingSOS(sosData) {
  const db = await getDB();
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await db.put('pending-sos', { ...sosData, tempId, createdAt: new Date().toISOString(), synced: false });
  return tempId;
}

export async function getPendingSOS() {
  const db = await getDB();
  return db.getAll('pending-sos');
}

export async function deletePendingSOS(tempId) {
  const db = await getDB();
  await db.delete('pending-sos', tempId);
}

export async function cacheSOSAlerts(alerts) {
  const db = await getDB();
  const tx = db.transaction('cached-sos', 'readwrite');
  for (const alert of alerts) {
    await tx.store.put(alert);
  }
  await tx.done;
}

export async function getCachedSOS() {
  const db = await getDB();
  return db.getAll('cached-sos');
}

export async function savePendingMessage(msgData) {
  const db = await getDB();
  const tempId = `msg_${Date.now()}`;
  await db.put('pending-messages', { ...msgData, tempId });
  return tempId;
}

export async function getPendingMessages() {
  const db = await getDB();
  return db.getAll('pending-messages');
}

export async function deletePendingMessage(tempId) {
  const db = await getDB();
  await db.delete('pending-messages', tempId);
}

export async function cacheUserProfile(user) {
  const db = await getDB();
  await db.put('user-profile', user);
}

export async function getCachedUserProfile() {
  const db = await getDB();
  const all = await db.getAll('user-profile');
  return all[0] || null;
}
