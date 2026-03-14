'use client';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useTaskRealtime(sosId: string, onUpdate: () => void) {
  useEffect(() => {
    if (!supabase || !sosId) return;

    console.log(`[Realtime] Subscribing to Task table for SOS: ${sosId}`);
    
    const channel = supabase
      .channel(`task-changes-${sosId}`)
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'Task',
          filter: `sosId=eq.${sosId}`
        },
        (payload) => {
          console.log('[Realtime] Task Change detected:', payload.eventType);
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [sosId, onUpdate]);
}
