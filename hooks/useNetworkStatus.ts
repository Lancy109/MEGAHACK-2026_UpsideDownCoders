'use client';
import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline]         = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [wasOffline, setWasOffline]     = useState(false);
  const [connectionType, setConnectionType] = useState('unknown');

  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      setWasOffline(true);
      setTimeout(() => setWasOffline(false), 5000);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Detect connection quality
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      setConnectionType(conn.effectiveType || 'unknown');
      conn.addEventListener('change', () => {
        setConnectionType(conn.effectiveType || 'unknown');
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline, connectionType };
}
