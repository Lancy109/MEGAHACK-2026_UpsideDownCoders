'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';

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
      const map = new Map(prev.map(m => [m.id, m]));
      incoming.forEach(m => { if (!map.has(m.id)) map.set(m.id, m); });
      return Array.from(map.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
    incoming.forEach(m => loadedIds.current.add(m.id));
  }, []);

  const socket = useSocket({
    chat_message: (msg: ChatMessage) => {
      if (msg.sosId === sosId) addMessages([msg]);
    },
    typing_start: ({ userId, name }: { userId: string; name: string }) => {
      if (userId !== currentUserId) {
        setTypingUsers(prev => ({ ...prev, [userId]: name }));
      }
    },
    typing_stop: ({ userId }: { userId: string }) => {
      setTypingUsers(prev => { const n = { ...prev }; delete n[userId]; return n; });
    },
  });

  // Join chat room on mount
  useEffect(() => {
    if (!socket || !sosId) return;
    socket.emit('join_chat', sosId);
    return () => { socket.emit('leave_chat', sosId); };
  }, [socket, sosId]);

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
      body: JSON.stringify({ senderId: currentUserId, senderName, senderRole, message, messageType }),
    });
    const data = await res.json();
    
    // Add locally instantly for this user
    if (!data.error) {
      addMessages([data]);
      if (socket) {
        socket.emit('broadcast_message', data);
      }
    }
    
    return data;
  }, [sosId, currentUserId, socket, addMessages]);

  const emitTyping = useCallback((isTyping: boolean, name: string) => {
    if (!socket) return;
    socket.emit(isTyping ? 'typing_start' : 'typing_stop', { sosId, userId: currentUserId, name });
  }, [socket, sosId, currentUserId]);

  return { messages, hasMore, typingUsers, loadEarlier, sendMessage, emitTyping };
}
