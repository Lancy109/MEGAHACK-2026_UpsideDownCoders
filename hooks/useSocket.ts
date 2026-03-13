'use client';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

let globalSocket: Socket | null = null;

type EventMap = Record<string, (...args: any[]) => void>;

export function useSocket(events: EventMap = {}) {
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    if (!globalSocket) {
      globalSocket = io(window.location.origin, {
        transports: ['websocket', 'polling'],
      });
    }

    const socket = globalSocket;

    Object.entries(eventsRef.current).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.keys(eventsRef.current).forEach((event) => {
        socket.off(event);
      });
    };
  }, []);

  return globalSocket;
}
