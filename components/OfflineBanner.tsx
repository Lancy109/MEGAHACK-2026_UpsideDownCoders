'use client';
import { useEffect, useState, useCallback } from 'react';
import { getPendingCount, flushQueue, enqueueSOSPacket } from '@/lib/offlineDB';

export default function OfflineBanner() {
  const [isOnline, setIsOnline]       = useState(true);
  const [queueCount, setQueueCount]   = useState(0);
  const [flushing, setFlushing]       = useState(false);
  const [flushProgress, setFlushProgress] = useState(0);
  const [showGreen, setShowGreen]     = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setQueueCount(count);
    } catch { /* idb not available SSR */ }
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshCount();

    const handleOnline = async () => {
      setIsOnline(true);
      setFlushing(true);
      setFlushProgress(0);

      try {
        await flushQueue(
          async (item: any) => {
            await fetch('/api/sos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...item, source: 'QUEUED' }),
            });
          },
          (done: number, total: number) => {
            setFlushProgress(Math.round((done / total) * 100));
          }
        );
      } catch { /* ignore */ }

      setFlushing(false);
      setShowGreen(true);
      await refreshCount();
      setTimeout(() => setShowGreen(false), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('resqnet:online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('resqnet:online', handleOnline);
    };
  }, [refreshCount]);

  if (isOnline && !showGreen) return null;

  if (showGreen) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] bg-emerald-600 text-white text-center py-2 px-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 animate-in slide-in-from-top duration-300">
        <span className="w-2 h-2 bg-white rounded-full" />
        Back online — {flushing ? `Syncing... ${flushProgress}%` : 'All queued SOS alerts uploaded'}
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white py-2 px-4 flex items-center justify-between text-xs font-black uppercase tracking-widest">
      <div className="flex items-center gap-3">
        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
        <span>Offline Mode</span>
      </div>
      {queueCount > 0 && (
        <span className="bg-white/20 px-3 py-1 rounded-full">
          {queueCount} SOS queued
        </span>
      )}
      <span className="opacity-60">Will auto-sync when signal returns</span>
    </div>
  );
}
