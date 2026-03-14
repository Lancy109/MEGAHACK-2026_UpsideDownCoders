'use client';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useAlertRealtime(onNewAlert: (alert: any) => void) {
  useEffect(() => {
    if (!supabase) return;

    console.log('[Realtime] Subscribing to DisasterAlert table');
    
    const channel = supabase
      .channel('disaster-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'DisasterAlert'
        },
        (payload) => {
          console.log('[Realtime] New Disaster Alert detected!');
          onNewAlert(payload.new);
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [onNewAlert]);
}
