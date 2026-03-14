'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  id: string;
  sosId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  messageType: string;
  createdAt: string;
}

export function useChat(sosId: string, currentUserId: string) {
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore]       = useState(false);
  const [page, setPage]             = useState(1);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const loadedIds = useRef<Set<string>>(new Set());

  const addMessages = useCallback((incoming: ChatMessage[]) => {
    setMessages(prev => {
      // Create a map to filter out duplicates instantly
      const map = new Map(prev.map(m => [m.id, m]));
      let newArrivals = false;

      incoming.forEach(m => { 
        if (!map.has(m.id)) {
          map.set(m.id, m); 
          loadedIds.current.add(m.id);
          newArrivals = true;
        }
      });

      if (!newArrivals) return prev; // No changes, keep reference same

      return Array.from(map.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, []);

  // Supabase Realtime Subscription
  useEffect(() => {
    if (!sosId || !supabase) return;

    console.log(`[Supabase] Subscribing to ChatMessage for SOS: ${sosId}`);

    const channel = supabase
      .channel(`chat_${sosId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ChatMessage',
          filter: `sosId=eq.${sosId}`
        },
        (payload: { new: ChatMessage }) => {
          console.log('[Supabase] Realtime message received:', payload.new);
          addMessages([payload.new as ChatMessage]);
        }
      )
      .subscribe((status: string) => {
        console.log(`[Supabase] Subscription status: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sosId, addMessages]);

  // Fetch latest page on mount
  useEffect(() => {
    if (!sosId) return;
    fetch(`/api/sos/${sosId}/chat?page=1&limit=25`)
      .then(r => r.json())
      .then(data => {
        if (data.messages) {
          addMessages(data.messages);
          setHasMore(data.hasMore);
          setPage(1);
        }
      }).catch(() => {});
  }, [sosId, addMessages]);

  const loadEarlier = useCallback(async () => {
    const nextPage = page + 1;
    const res = await fetch(`/api/sos/${sosId}/chat?page=${nextPage}&limit=25`);
    const data = await res.json();
    if (data.messages) {
      addMessages(data.messages);
      setHasMore(data.hasMore);
      setPage(nextPage);
    }
  }, [sosId, page, addMessages]);

  const sendMessage = useCallback(async (
    message: string,
    senderName: string,
    senderRole: string,
    messageType = 'TEXT'
  ) => {
    if (!message.trim()) return;
    
    const res = await fetch(`/api/sos/${sosId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        senderId: currentUserId, 
        senderName, 
        senderRole, 
        message, 
        messageType 
      }),
    });
    const data = await res.json();
    
    // Add locally instantly to ensure responsive UI
    if (!data.error) {
      addMessages([data]);
    }
    
    return data;
  }, [sosId, currentUserId, addMessages]);

  // Legacy typing placeholder - Supabase Realtime Broadcast can handle this too if needed
  const emitTyping = useCallback((isTyping: boolean, name: string) => {
    // For now we prioritize basic chat delivery
  }, []);

  return { messages, hasMore, typingUsers, loadEarlier, sendMessage, emitTyping };
}
