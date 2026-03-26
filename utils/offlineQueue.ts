// utils/offlineQueue.ts
import { openDB } from 'idb';

const dbPromise = typeof window !== 'undefined' ? openDB('resqnet-db', 1, {
    upgrade(db) {
        db.createObjectStore('sos-queue', { keyPath: 'id', autoIncrement: true });
    },
}) : null;

export async function queueSOSRequest(sosData: any) {
    const db = await dbPromise;
    if (db) await db.add('sos-queue', { ...sosData, timestamp: Date.now() });
}

export async function syncOfflineSOS() {
    const db = await dbPromise;
    if (!db) return;

    const tx = db.transaction('sos-queue', 'readwrite');
    const store = tx.objectStore('sos-queue');
    const queuedRequests = await store.getAll();

    for (const req of queuedRequests) {
        try {
            // Sends the queued request to your existing backend route
            const response = await fetch('/api/sos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req)
            });

            if (response.ok) {
                await store.delete(req.id); // Removes from queue once successfully sent
            }
        } catch (e) {
            console.log('Still offline, will retry later.');
            break;
        }
    }
}