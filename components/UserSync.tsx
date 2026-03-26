'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useRef } from 'react';
import { syncOfflineSOS } from '@/utils/offlineQueue';

export default function UserSync() {
  const { user, isLoaded } = useUser();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (isLoaded && user && !syncedRef.current) {
      const role = user.publicMetadata?.role as string;
      
      // Sync EVERY logged-in user to the DB to ensure they can receive broadcasts
      fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          name: user.fullName || user.username || 'User',
          email: user.primaryEmailAddress?.emailAddress || '',
          phone: user.primaryPhoneNumber?.phoneNumber || 'N/A',
          role: role || 'VICTIM'
        })
      }).then(() => {
        syncedRef.current = true;
      }).catch(err => {
        console.error('Failed to sync user:', err);
      });
    }
  }, [isLoaded, user]);

  useEffect(() => {
    // 1. Listen for the exact moment the phone reconnects to the internet
    window.addEventListener('online', syncOfflineSOS);

    // 2. Try syncing immediately on app load just in case it closed while offline
    if (navigator.onLine) {
      syncOfflineSOS();
    }

    return () => {
      window.removeEventListener('online', syncOfflineSOS);
    };
  }, []);

  return null;
}
