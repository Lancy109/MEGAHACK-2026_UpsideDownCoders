'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useNetworkStatus } from './useNetworkStatus';

export interface Alert {
  id: string;
  message: string;
  severity: string;
  area?: string;
  source: string;
  createdAt: string;
}

export function useAlerts(limit = 10) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [connStatus, setConnStatus] = useState<string>('connecting');
  const { isOnline } = useNetworkStatus();
  const loadedIds = useRef(new Set<string>());

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`/api/alerts?limit=${limit}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setAlerts(data);
        data.forEach((a: Alert) => loadedIds.current.add(a.id));
      }
    } catch (err) {
      console.error('[useAlerts] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Initial fetch and re-fetch on reconnect
  useEffect(() => {
    if (isOnline) {
      fetchAlerts();
    }
  }, [isOnline, fetchAlerts]);

  useEffect(() => {
    if (!supabase) {
       setConnStatus('unconfigured');
       return;
    }

    const channel = supabase
      .channel('public:DisasterAlert')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'DisasterAlert' },
        (payload) => {
          const newAlert = payload.new as Alert;
          if (!loadedIds.current.has(newAlert.id)) {
            loadedIds.current.add(newAlert.id);
            setAlerts((prev) => [newAlert, ...prev].slice(0, limit));
            
            // Notification sound for new alerts
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.connect(gain); gain.connect(audioCtx.destination);
              osc.frequency.value = 550; gain.gain.value = 0.1;
              osc.start(); setTimeout(() => { osc.stop(); audioCtx.close(); }, 400);
            } catch {}
          }
        }
      )
      .subscribe((status: string) => {
        console.log(`[Supabase] Alerts channel status: ${status}`);
        setConnStatus(status);
      });

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [limit]);

  return { alerts, loading, connStatus, refresh: fetchAlerts };
}
