'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSocket } from '@/hooks/useSocket';
import { usePathname } from 'next/navigation';

type BroadcastMessage = {
  id: string;
  message: string;
  target: string;
  userIds: string | null;
  createdAt: string;
};

export default function NotificationPanel() {
  const { user, isLoaded } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();

  // Filter logic similar to GlobalToasts
  const shouldShowMessage = (msg: BroadcastMessage) => {
    if (!user) return false;
    const myId = (user.publicMetadata as any)?.dbId || user.id;
    const myRole = (user.publicMetadata as any)?.role as string | undefined;

    // Allow NGOs (or anyone currently on the NGO dashboard) to see all broadcasts
    if (myRole === 'NGO' || pathname?.startsWith('/ngo')) return true;

    // 1. Explicit targeted broadcast via User IDs (Prioritized)
    if (msg.userIds) {
      try {
        const ids = JSON.parse(msg.userIds);
        if (Array.isArray(ids) && ids.includes(myId)) return true;
      } catch (e) {
        console.error('Failed to parse userIds from broadcast:', e);
      }
    } 
    // 2. Global or Role-based broadcast (Fallback or ALL)
    else {
      if (msg.target === 'ALL' || msg.target === 'GLOBAL') return true;
      if (msg.target === 'VOLUNTEERS' && myRole === 'VOLUNTEER') return true;
      if ((msg.target === 'VICTIMS' || msg.target === 'VICTIMS_ALL' || msg.target === 'VICTIMS_ACTIVE') && (myRole === 'VICTIM' || !myRole)) return true;
      if (msg.target.startsWith('VICTIMS_') && (myRole === 'VICTIM' || !myRole)) return true;
    }

    return false;
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/notify/broadcast');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.broadcasts)) {
        const filtered = data.broadcasts.filter(shouldShowMessage);
        setMessages(filtered);
        
        // Simple unread logic: count how many we haven't seen since last open
        const lastSeenStr = localStorage.getItem('last_seen_broadcasts');
        const lastSeenTime = lastSeenStr ? new Date(lastSeenStr).getTime() : 0;
        
        const unread = filtered.filter((m: BroadcastMessage) => new Date(m.createdAt).getTime() > lastSeenTime).length;
        setUnreadCount(unread);
      }
    } catch (e) {
      console.error('Failed to fetch broadcasts:', e);
    }
  };

  useEffect(() => {
    if (isLoaded && user) {
      fetchMessages();
    }
  }, [isLoaded, user]);

  // Real-time updates via Socket
  useSocket({
    broadcast_receive: (data: any) => {
      // Create a temporary BroadcastMessage matching the database structure
      const newMsg: BroadcastMessage = {
        id: `brd_temp_${Date.now()}`,
        message: data.message,
        target: data.target,
        userIds: data.userIds ? JSON.stringify(data.userIds) : null,
        createdAt: new Date(data.timestamp || Date.now()).toISOString()
      };

      if (shouldShowMessage(newMsg)) {
        setMessages(prev => [newMsg, ...prev].slice(0, 50)); // Keep only 50
        if (!isOpen) {
          setUnreadCount(prev => prev + 1);
        }
      }
    }
  });

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const togglePanel = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      setUnreadCount(0);
      localStorage.setItem('last_seen_broadcasts', new Date().toISOString());
    }
  };

  const getRelativeTime = (dateStr: string) => {
    const timeMs = new Date(dateStr).getTime();
    const diffMs = Date.now() - timeMs;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (!isLoaded || !user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={togglePanel}
        className="relative p-2 rounded-full text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
        aria-label="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-red-600 text-white text-[8px] font-bold border-2 border-white">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[1002] transform transition-all origin-top-right">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Notifications</h3>
            {messages.length > 0 && (
              <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                {messages.length} 
              </span>
            )}
          </div>
          
          <div className="max-h-[70vh] overflow-y-auto w-full">
            {messages.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-slate-500">No new notifications</p>
                <p className="text-xs text-slate-400 mt-1">You're all caught up!</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50 w-full">
                {messages.map((msg, index) => (
                  <li key={msg.id || index} className="p-4 hover:bg-red-50/50 transition-colors w-full group cursor-default">
                    <div className="flex gap-3 w-full">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="h-8 w-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center border border-red-200 group-hover:bg-red-600 group-hover:text-white transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                          </svg>
                        </div>
                      </div>
                      <div className="w-full">
                        <p className="text-sm font-bold text-slate-800 leading-snug break-words">
                          {msg.message}
                        </p>
                        <p className="text-[10px] font-black uppercase text-slate-400 mt-2 tracking-widest flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {getRelativeTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
