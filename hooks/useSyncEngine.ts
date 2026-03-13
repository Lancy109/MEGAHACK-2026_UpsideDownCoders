'use client';
import { useEffect, useCallback } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import {
  getPendingSOS, deletePendingSOS,
  getPendingMessages, deletePendingMessage,
} from '@/lib/offlineDB';

export function useSyncEngine() {
  const { isOnline, wasOffline } = useNetworkStatus();

  const syncPendingSOS = useCallback(async () => {
    const pending = await getPendingSOS();
    if (pending.length === 0) return;
    console.log(`Syncing ${pending.length} pending SOS alerts...`);
    for (const sos of pending) {
      try {
        const { tempId, synced, ...sosData } = sos;
        const res = await fetch('/api/sos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sosData),
        });
        if (res.ok) {
          await deletePendingSOS(tempId);
          console.log('Synced SOS:', tempId);
        }
      } catch (err) {
        console.error('Failed to sync SOS:', err);
      }
    }
  }, []);

  const syncPendingMessages = useCallback(async () => {
    const pending = await getPendingMessages();
    for (const msg of pending) {
      try {
        const { tempId, ...msgData } = msg;
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msgData),
        });
        if (res.ok) await deletePendingMessage(tempId);
      } catch {}
    }
  }, []);

  const syncAll = useCallback(async () => {
    await Promise.all([syncPendingSOS(), syncPendingMessages()]);
  }, [syncPendingSOS, syncPendingMessages]);

  // Auto sync when coming back online
  useEffect(() => {
    if (isOnline) syncAll();
  }, [isOnline, syncAll]);

  // Sync every 30 seconds when online
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(syncAll, 30000);
    return () => clearInterval(interval);
  }, [isOnline, syncAll]);

  return { syncAll, isOnline, wasOffline };
}
