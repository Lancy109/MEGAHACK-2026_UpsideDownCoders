'use client';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { detectGPS } from '@/utils/gps';
import { savePendingSOS } from '@/lib/offlineDB';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export default function PanicPage() {
  const { user } = useUser();
  const { isOnline } = useNetworkStatus();
  const [state, setState] = useState('idle'); // idle | countdown | sending | sent | error
  const [countdown, setCountdown] = useState(5);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [holdInterval, setHoldInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    detectGPS().then(setGps).catch(() => {});
  }, []);

  useEffect(() => {
    if (state === 'countdown') {
      if (countdown === 0) {
        sendPanicSOS();
        return;
      }
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [state, countdown]);

  function startHold() {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setState('countdown');
        setCountdown(5);
      }
    }, 40); // 2 seconds hold
    setHoldInterval(interval);
  }

  function cancelHold() {
    if (holdInterval) {
      clearInterval(holdInterval);
      setHoldInterval(null);
    }
    setHoldProgress(0);
    if (state !== 'countdown' && state !== 'sending' && state !== 'sent') {
      setState('idle');
    }
  }

  function cancelCountdown() {
    setState('idle');
    setCountdown(5);
    setHoldProgress(0);
  }

  async function sendPanicSOS() {
    setState('sending');
    const coords = gps || { lat: 0, lng: 0 };
    const payload = {
      type: 'RESCUE',
      description: '🚨 PANIC BUTTON ACTIVATED — Immediate rescue needed. Victim in critical danger.',
      lat: coords.lat,
      lng: coords.lng,
      userId: (user?.publicMetadata as any)?.dbId || user?.id || 'anonymous',
      language: 'English',
      isPanic: true,
    };

    try {
      if (!isOnline) {
        await savePendingSOS(payload);
        setState('sent');
        return;
      }
      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) setState('sent');
      else setState('error');
    } catch {
      await savePendingSOS(payload);
      setState('sent');
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      {state === 'idle' && (
        <>
          <h1 className="text-white font-black text-4xl mb-3 text-center tracking-tighter">Panic Button</h1>
          <p className="text-slate-500 text-sm text-center mb-16 font-medium">Hold the button for 2 seconds to initiate immediate rescue protocol</p>

          <div className="relative flex items-center justify-center">
            {/* Progress ring */}
            <svg className="absolute" width="240" height="240" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" fill="none" stroke="#1f2937" strokeWidth="8" />
              <circle
                cx="100" cy="100" r="90" fill="none"
                stroke="#ef4444" strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 90}`}
                strokeDashoffset={`${2 * Math.PI * 90 * (1 - holdProgress / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
                style={{ transition: 'stroke-dashoffset 0.04s linear' }}
              />
            </svg>
            <button
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={startHold}
              onTouchEnd={cancelHold}
              className="w-44 h-44 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-3xl shadow-[0_0_50px_rgba(239,68,68,0.3)] transition-all select-none flex flex-col items-center justify-center gap-2"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="w-4 h-4 rounded-full bg-white mb-1 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
              <span className="tracking-[0.2em] text-lg mt-1">HOLD</span>
            </button>
          </div>

          <p className="text-slate-600 text-xs mt-12 text-center font-mono py-2 px-4 bg-white/5 rounded-full border border-white/5">
            GPS LOCK: {gps ? `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : 'ACQUIRING...'}
          </p>
        </>
      )}

      {state === 'countdown' && (
        <div className="text-center flex flex-col items-center">
          <p className="text-red-400 font-black text-2xl mb-6 uppercase tracking-[0.2em] animate-pulse">Broadcasting SOS in...</p>
          <div className="text-[12rem] leading-none font-black text-red-600 animate-bounce select-none">{countdown}</div>
          <button onClick={cancelCountdown}
            className="mt-12 bg-white/10 hover:bg-white/20 text-white font-black px-10 py-5 rounded-2xl text-xl transition-all border border-white/10 active:scale-95 shadow-xl">
            ✕ ABORT MISSION
          </button>
        </div>
      )}

      {state === 'sending' && (
        <div className="text-center">
          <div className="relative mb-8 flex items-center justify-center h-32 w-32 mx-auto">
             <div className="absolute w-full h-full border border-red-500/30 rounded-full animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
             <div className="absolute w-20 h-20 border border-red-500/50 rounded-full animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]" />
             <div className="w-4 h-4 bg-red-600 rounded-full shadow-[0_0_20px_rgba(239,68,68,1)]" />
          </div>
          <p className="text-white font-black text-3xl animate-pulse tracking-tight">TRANSMITTING SOS...</p>
          <p className="text-slate-500 text-sm mt-3 font-medium italic">Establishing priority uplink</p>
        </div>
      )}

      {state === 'sent' && (
        <div className="text-center slide-in flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-emerald-900/40 border border-emerald-500/30 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
             <div className="w-8 h-4 border-b-4 border-l-4 border-emerald-400 -rotate-45 -mt-2" />
          </div>
          <h2 className="text-emerald-400 font-black text-4xl mb-4 tracking-tighter">BROADCAST SUCCESS</h2>
          <p className="text-slate-400 text-sm mb-12 max-w-xs font-medium">Emergency responders and nearby volunteers have been notified of your location.</p>
          <button onClick={() => { setState('idle'); setHoldProgress(0); }}
            className="bg-slate-900 border border-slate-800 hover:border-slate-600 text-white font-black px-8 py-4 rounded-2xl text-sm transition-all active:scale-95">
            LOG ANOTHER EMERGENCY
          </button>
        </div>
      )}

      {state === 'error' && (
        <div className="text-center flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-red-900/40 border border-red-500/30 flex flex-col items-center justify-center mb-8 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
             <div className="w-2 h-8 bg-red-500 rounded-full mb-2" />
             <div className="w-2 h-2 bg-red-500 rounded-full" />
          </div>
          <p className="text-red-500 font-black text-2xl mb-6 uppercase tracking-widest">Broadcast Failed</p>
          <button onClick={() => setState('idle')} className="bg-red-600 hover:bg-red-700 text-white font-black px-8 py-4 rounded-2xl shadow-lg transition-all active:scale-95">RETRY NOW</button>
        </div>
      )}
    </div>
  );
}
