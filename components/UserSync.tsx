'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useRef } from 'react';

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

  return null;
}
