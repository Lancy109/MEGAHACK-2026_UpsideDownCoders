'use client';
import { useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useUser } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';

const SEVERITY = {
  CRITICAL: { bg: 'bg-red-600', border: 'border-red-500', text: 'text-red-600', label: 'CRITICAL EMERGENCY', lightBg: 'bg-red-50' },
  HIGH:     { bg: 'bg-orange-500', border: 'border-orange-400', text: 'text-orange-600', label: 'HIGH PRIORITY', lightBg: 'bg-orange-50' },
  MEDIUM:   { bg: 'bg-yellow-500', border: 'border-yellow-400', text: 'text-yellow-700', label: 'MEDIUM ALERT', lightBg: 'bg-yellow-50' },
  LOW:      { bg: 'bg-blue-500', border: 'border-blue-400', text: 'text-blue-700', label: 'LOW ADVISORY', lightBg: 'bg-blue-50' },
  BROADCAST:{ bg: 'bg-red-600', border: 'border-red-500', text: 'text-red-600', label: 'NGO BROADCAST', lightBg: 'bg-red-50' },
};

interface Toast {
  id: string;
  type: 'ESCALATION' | 'BROADCAST';
  message?: string;
  lat?: number;
  lng?: number;
  sosType?: string;
  minutesWaiting?: number;
  victimName?: string;
  timestamp: number;
}

export default function GlobalToasts() {
  const { user } = useUser();
  const pathname = usePathname();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useSocket({
    escalation_alert: (data: any) => {
      const myRole = (user?.publicMetadata as any)?.role;
      // Show escalation to Volunteers and NGOs
      if (myRole === 'VOLUNTEER' || myRole === 'NGO' || pathname?.startsWith('/ngo')) {
        const newToast: Toast = {
          id: `esc_${Date.now()}_${data.sosId}`,
          type: 'ESCALATION',
          sosType: data.type,
          lat: data.lat,
          lng: data.lng,
          minutesWaiting: data.minutesWaiting,
          victimName: data.victimName,
          timestamp: Date.now()
        };
        setToasts(prev => {
           if (prev.find(t => t.id === newToast.id)) return prev;
           return [...prev, newToast];
        });
      }
    },
    broadcast_receive: (data: any) => {
      const myId = (user?.publicMetadata as any)?.dbId || user?.id;
      const myRole = (user?.publicMetadata as any)?.role as string | undefined;
      
      let shouldShow = false;
      
      // Allow NGOs (or anyone dynamically testing as NGO) to monitor everything
      if (myRole === 'NGO' || pathname?.startsWith('/ngo')) shouldShow = true;
      
      // 1. Explicit targeted broadcast via User IDs (Prioritized)
      else if (data.userIds && Array.isArray(data.userIds)) {
        if (myId && data.userIds.includes(myId)) shouldShow = true;
      } 
      // 2. Global or Role-based broadcast (Fallback or ALL)
      else {
        if (data.target === 'ALL') shouldShow = true;
        else if (data.target === 'VOLUNTEERS' && myRole === 'VOLUNTEER') shouldShow = true;
        else if ((data.target === 'VICTIMS' || data.target === 'VICTIMS_ALL' || data.target === 'VICTIMS_ACTIVE') && (myRole === 'VICTIM' || !myRole)) shouldShow = true;
        // Granular victim targets (handled primarily by userIds, but fallback for safety)
        else if (data.target.startsWith('VICTIMS_') && (myRole === 'VICTIM' || !myRole)) shouldShow = true;
      }

      // 3. NGO staff exclusion (removed to allow NGOs to see their own broadcasts)
      // if (myRole === 'NGO') shouldShow = false;

      if (shouldShow) {
        const newToast: Toast = {
          id: `brd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'BROADCAST',
          message: data.message,
          timestamp: data.timestamp || Date.now()
        };
        setToasts(prev => [...prev, newToast]);

        // Urgent Sound
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain); gain.connect(audioCtx.destination);
          osc.type = 'square'; // Harder sound
          osc.frequency.setValueAtTime(440, audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
          gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
          osc.start(); setTimeout(() => { osc.stop(); audioCtx.close(); }, 350);
        } catch {}
      }
    }
  });

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[9999] flex flex-col gap-4 max-w-sm w-full pointer-events-none">
      {toasts.slice(-3).map((t) => (
        <div 
          key={t.id} 
          className="pointer-events-auto p-5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-4 flex flex-col gap-3 animate-bounce-subtle slide-in bg-red-600 border-red-500 text-white"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 px-3 py-1.5 rounded-xl backdrop-blur-md">
              {t.type === 'ESCALATION' ? '⚠️ URGENT ESCALATION' : '📢 OFFICIAL BROADCAST'}
            </span>
            <button 
              onClick={() => removeToast(t.id)} 
              className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors text-white font-bold"
            >
              ✕
            </button>
          </div>

          {t.type === 'ESCALATION' ? (
            <div>
              <p className="text-sm font-black leading-tight mb-1">Priority {t.sosType} Alert</p>
              <p className="text-[10px] font-bold text-white/90 uppercase tracking-widest mb-3">
                Location: {t.lat?.toFixed(3)}, {t.lng?.toFixed(3)} • Victim: {t.victimName}
              </p>
              <p className="text-xs font-medium italic bg-white/10 p-3 rounded-xl border border-white/10">
                Waiting {t.minutesWaiting}+ minutes. Immediate manual intervention required.
              </p>
            </div>
          ) : (
             <div>
               <p className="text-sm font-black italic leading-snug mb-2">"{t.message}"</p>
               <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest">
                 Sent {new Date(t.timestamp).toLocaleTimeString()}
               </p>
             </div>
          )}
          
          <button 
            onClick={() => removeToast(t.id)}
            className="w-full py-2.5 bg-white text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all active:scale-[0.98]"
          >
            Acknowledge Message
          </button>
        </div>
      ))}
    </div>
  );
}
