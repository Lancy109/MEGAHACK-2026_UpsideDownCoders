'use client';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useSosEventRealtime(sosId: string, onUpdate: () => void) {
  useEffect(() => {
    if (!supabase || !sosId) return;

    console.log(`[Realtime] Subscribing to SosEvent table for SOS: ${sosId}`);
    
    const channel = supabase
      .channel(`sos-event-changes-${sosId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT', 
          schema: 'public',
          table: 'SosEvent',
          filter: `sosId=eq.${sosId}`
        },
        (payload) => {
          console.log('[Realtime] SOS Event detected!');
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [sosId, onUpdate]);
}
