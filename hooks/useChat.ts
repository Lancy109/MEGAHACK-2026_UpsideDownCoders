'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useSocket } from './useSocket';
import { useNetworkStatus } from './useNetworkStatus';

export interface ChatMessage {
  id: string;
  sosId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  messageType: string;
  readBy: string[];
  createdAt: string;
  status?: 'sending' | 'delivered' | 'failed';
  optimistic?: boolean;
}

export function useChat(sosId: string, currentUserId: string) {
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [loading, setLoading]         = useState(true);
  const [sending, setSending]         = useState(false);
  const [hasMore, setHasMore]         = useState(false);
  const [cursor, setCursor]           = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [supabaseStatus, setSupabaseStatus] = useState<string>('connecting');
  const [socketConnected, setSocketConnected] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const messageIds   = useRef<Set<string>>(new Set());
  const channelRef   = useRef<any>(null);
  const typingTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const { isOnline } = useNetworkStatus();
  const socket = useSocket({});

  // ── Deduplicated add helper ──────────────────────────────────────────────────
  const addMessages = useCallback((incoming: ChatMessage[]) => {
    setMessages(prev => {
      const reallyNew = incoming.filter(m => !messageIds.current.has(m.id));
      if (reallyNew.length === 0) return prev;

      // Remove optimistic messages replaced by confirmed server messages
      const tempIdsToRemove = new Set<string>();
      reallyNew.forEach(newMsg => {
        prev.forEach(oldMsg => {
          if (
            oldMsg.optimistic &&
            oldMsg.message === newMsg.message &&
            oldMsg.senderId === newMsg.senderId
          ) {
            tempIdsToRemove.add(oldMsg.id);
          }
        });
        messageIds.current.add(newMsg.id);
      });

      const filtered = prev.filter(m => !tempIdsToRemove.has(m.id));
      return [...filtered, ...reallyNew].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, []);

  // ── Initial fetch ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sosId) return;
    setLoading(true);
    messageIds.current = new Set();

    fetch(`/api/chat?sosId=${sosId}&limit=50`)
      .then(r => r.json())
      .then(data => {
        if (data.messages) {
          data.messages.forEach((m: ChatMessage) => messageIds.current.add(m.id));
          // Sort to ASC for UI display
          const sorted = [...data.messages].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          setMessages(sorted);
          setHasMore(data.hasMore);
          setCursor(data.nextCursor);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sosId]);

  // ── Reconnect refetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOnline && sosId) {
      fetch(`/api/chat?sosId=${sosId}&limit=50`)
        .then(r => r.json())
        .then(data => {
          if (data.messages) addMessages(data.messages);
        })
        .catch(() => {});
    }
  }, [isOnline, sosId, addMessages]);

  // ── Mark as read ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sosId || !currentUserId || messages.length === 0) return;
    const hasUnread = messages.some(m => !m.readBy?.includes(currentUserId));
    if (!hasUnread) return;
    fetch('/api/chat/read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sosId, userId: currentUserId }),
    }).catch(() => {});
  }, [sosId, currentUserId, messages]);

  // ── LAYER 1: Socket.io ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !sosId) return;
    
    console.log('[useChat] Socket joining room:', `chat_${sosId}`);
    socket.emit('join_chat', sosId);

    const handleConnect = () => {
      console.log('[useChat] Socket connected:', socket.id);
      setSocketConnected(true);
    };
    const handleDisconnect = () => {
      console.log('[useChat] Socket disconnected');
      setSocketConnected(false);
    };

    const handleMessage = (msg: ChatMessage) => {
      console.log('[useChat] Socket message received:', msg.id, 'for SOS:', msg.sosId);
      if (msg.sosId !== sosId) {
        console.warn('[useChat] Received message for different SOS:', msg.sosId, 'expected:', sosId);
        return;
      }
      if (msg.senderId === currentUserId) return;
      addMessages([{ ...msg, status: 'delivered' }]);
    };

    const handleTypingStart = ({ userId, name }: { userId: string; name: string }) => {
      if (userId === currentUserId) return;
      setTypingUsers(prev => ({ ...prev, [userId]: name }));
      if (typingTimers.current[userId]) clearTimeout(typingTimers.current[userId]);
      typingTimers.current[userId] = setTimeout(() => {
        setTypingUsers(prev => { const n = { ...prev }; delete n[userId]; return n; });
      }, 3000);
    };

    const handleTypingStop = ({ userId }: { userId: string }) => {
      if (userId === currentUserId) return;
      setTypingUsers(prev => { const n = { ...prev }; delete n[userId]; return n; });
      if (typingTimers.current[userId]) clearTimeout(typingTimers.current[userId]);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('chat_message', handleMessage);
    socket.on('typing_start', handleTypingStart);
    socket.on('typing_stop', handleTypingStop);

    if (socket.connected) handleConnect();

    return () => {
      console.log('[useChat] Socket leaving room:', `chat_${sosId}`);
      socket.emit('leave_chat', sosId);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('chat_message', handleMessage);
      socket.off('typing_start', handleTypingStart);
      socket.off('typing_stop', handleTypingStop);
    };
  }, [socket, sosId, currentUserId, addMessages]);

  // ── LAYER 2: Supabase Realtime broadcast (fallback) ──────────────────────────
  useEffect(() => {
    if (!sosId || !supabase) {
      setSupabaseStatus('unconfigured');
      return;
    }

    const channel = supabase
      .channel(`chat_${sosId}`)
      .on('broadcast', { event: 'new_message' }, ({ payload }: { payload: ChatMessage }) => {
        if (payload.senderId !== currentUserId) {
          addMessages([{ ...payload, status: 'delivered' }]);
        }
      })
      .on('broadcast', { event: 'typing' }, ({ payload }: { payload: { userId: string; name: string } }) => {
        if (payload.userId === currentUserId) return;
        setTypingUsers(prev => ({ ...prev, [payload.userId]: payload.name }));
        if (typingTimers.current[payload.userId]) clearTimeout(typingTimers.current[payload.userId]);
        typingTimers.current[payload.userId] = setTimeout(() => {
          setTypingUsers(prev => { const n = { ...prev }; delete n[payload.userId]; return n; });
        }, 3000);
      })
      .subscribe((status: string) => setSupabaseStatus(status));

    channelRef.current = channel;

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [sosId, currentUserId, addMessages]);

  // ── Load earlier messages ────────────────────────────────────────────────────
  const loadEarlier = useCallback(async () => {
    if (!hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/chat?sosId=${sosId}&cursor=${cursor}&limit=30`);
      const data = await res.json();
      if (data.messages) {
        const older = data.messages.filter((m: ChatMessage) => !messageIds.current.has(m.id));
        older.forEach((m: ChatMessage) => messageIds.current.add(m.id));
        setMessages(prev => [...older, ...prev].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ));
        setHasMore(data.hasMore);
        setCursor(data.nextCursor);
      }
    } catch {}
    setLoadingMore(false);
  }, [sosId, cursor, hasMore, loadingMore]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (
    message: string,
    senderName: string,
    senderRole: string,
    messageType = 'TEXT'
  ) => {
    if (!message.trim()) return;
    setSending(true);

    const tempId = `temp_${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      sosId,
      senderId: currentUserId,
      senderName,
      senderRole,
      message: message.trim(),
      messageType,
      readBy: [currentUserId],
      createdAt: new Date().toISOString(),
      status: 'sending',
      optimistic: true,
    };

    setMessages(prev => [...prev, optimistic]);

    console.log('[useChat] Sending message:', { sosId, senderName, messageType });
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sosId, senderId: currentUserId, senderName, senderRole, message, messageType }),
      });
      
      console.log('[useChat] Response status:', res.status);
      const data = await res.json();

      if (res.ok && !data.error) {
        console.log('[useChat] Message sent successfully:', data.id);
        const confirmed: ChatMessage = { ...data, status: 'delivered' };
        messageIds.current.add(confirmed.id);
        setMessages(prev => prev.map(m => m.id === tempId ? confirmed : m));

        // LAYER 1 BROADCAST: Socket.io Relay
        if (socket) {
          console.log('[useChat] Relaying via Socket.io:', confirmed.id);
          socket.emit('broadcast_message', confirmed);
        }

        // LAYER 2 BROADCAST: Supabase Realtime (Fallback)
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'new_message',
            payload: confirmed,
          });
        }
      } else {
        console.error('[useChat] Message failed (server error):', data.error || 'Unknown error');
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      }
      return data;
    } catch (err: any) {
      console.error('[useChat] Message failed (fetch error):', err.message);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
    } finally {
      setSending(false);
    }
  }, [sosId, currentUserId]);

  // ── Typing indicator emission ─────────────────────────────────────────────────
  const emitTyping = useCallback((isTyping: boolean, name: string) => {
    // Emit via Socket.io
    if (socket) {
      if (isTyping) {
        socket.emit('typing_start', { sosId, userId: currentUserId, name });
      } else {
        socket.emit('typing_stop', { sosId, userId: currentUserId });
      }
    }
    // Emit via Supabase broadcast as fallback
    if (channelRef.current && isTyping) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, name },
      });
    }
  }, [socket, sosId, currentUserId]);

  // ── Manual & Auto Refresh ──────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!sosId || refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/chat?sosId=${sosId}&limit=50`);
      const data = await res.json();
      if (data.messages) addMessages(data.messages);
    } catch (err) {
      console.error('[useChat] Manual refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }, [sosId, addMessages, refreshing]);

  useEffect(() => {
    // Auto-refresh every 10 seconds as a safety fallback
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const unreadCount = messages.filter(m => !m.readBy?.includes(currentUserId) && m.senderId !== currentUserId).length;

  return {
    messages,
    loading,
    sending,
    refreshing,
    hasMore,
    loadingMore,
    typingUsers,
    supabaseStatus,
    socketConnected,
    unreadCount,
    loadEarlier,
    sendMessage,
    emitTyping,
    refresh,
  };
}
