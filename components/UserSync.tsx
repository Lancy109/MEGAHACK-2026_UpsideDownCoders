'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useRef } from 'react';

export default function UserSync() {
  const { user, isLoaded } = useUser();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (isLoaded && user && !syncedRef.current) {
      const role = user.publicMetadata?.role as string;
      
      // We sync whenever a user lands on any page while logged in 
      // but we prioritize Volunteers and Victims for the NGO dashboard
      if (role === 'VOLUNTEER' || role === 'VICTIM' || role === 'NGO') {
        fetch('/api/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            name: user.fullName || user.username || 'User',
            email: user.primaryEmailAddress?.emailAddress || '',
            phone: user.primaryPhoneNumber?.phoneNumber || 'N/A',
            role: role
          })
        }).then(() => {
          syncedRef.current = true;
        }).catch(err => {
          console.error('Failed to sync user:', err);
        });
      }
    }
  }, [isLoaded, user]);

  return null;
}
