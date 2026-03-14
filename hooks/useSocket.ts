'use client';
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

let globalSocket: Socket | null = null;

type EventMap = Record<string, (...args: any[]) => void>;

/**
 * useSocket hook with stale-closure protection.
 * It uses 'relay' handlers to ensure that socket events always call 
 * the latest available version of the provided callback.
 */
export function useSocket(events: EventMap = {}) {
  const eventsRef = useRef(events);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(globalSocket);
  
  // Always keep the latest events in Ref to avoid stale closures
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    if (!globalSocket) {
      globalSocket = io(window.location.origin, {
        transports: ['websocket', 'polling'],
      });
      setSocketInstance(globalSocket);
    } else if (!socketInstance) {
      setSocketInstance(globalSocket);
    }

    const socket = globalSocket;
    const activeHandlers: Record<string, (...args: any[]) => void> = {};


    // Register relay handlers for each event
    Object.keys(eventsRef.current).forEach((event) => {
      const relay = (...args: any[]) => {
        if (eventsRef.current[event]) {
          eventsRef.current[event](...args);
        }
      };
      activeHandlers[event] = relay;
      socket.on(event, relay);
    });

    return () => {
      // Clean up only the specific relay handlers used by this component instance
      Object.entries(activeHandlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, []);

  return socketInstance;
}
