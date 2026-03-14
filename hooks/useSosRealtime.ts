'use client';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useSosRealtime(onUpdate: () => void) {
  useEffect(() => {
    if (!supabase) return;

    console.log('[Realtime] Subscribing to SosAlert table');
    
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'SosAlert'
        },
        (payload) => {
          console.log('[Realtime] SOS Change detected:', payload.eventType);
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}
