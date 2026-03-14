'use client';
import { useState, useEffect } from 'react';
import { useAlerts, Alert } from '@/hooks/useAlerts';
import { useUser } from '@clerk/nextjs';

const SEVERITY = {
  CRITICAL: { bg: 'bg-red-600', border: 'border-red-500', text: 'text-red-600', label: 'CRITICAL EMERGENCY', lightBg: 'bg-red-50' },
  HIGH:     { bg: 'bg-orange-500', border: 'border-orange-400', text: 'text-orange-600', label: 'HIGH PRIORITY', lightBg: 'bg-orange-50' },
  MEDIUM:   { bg: 'bg-yellow-500', border: 'border-yellow-400', text: 'text-yellow-700', label: 'MEDIUM ALERT', lightBg: 'bg-yellow-50' },
  LOW:      { bg: 'bg-blue-500', border: 'border-blue-400', text: 'text-blue-700', label: 'LOW ADVISORY', lightBg: 'bg-blue-50' },
  BROADCAST:{ bg: 'bg-indigo-600', border: 'border-indigo-500', text: 'text-indigo-600', label: 'NGO BROADCAST', lightBg: 'bg-indigo-50' },
};

export default function AlertBanner() {
  const { user } = useUser();
  const { alerts: alertQueue, loading } = useAlerts(10);
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Sync active alert with the top of the queue (filtering dismissed)
  useEffect(() => {
    const nextAlert = alertQueue.find(a => !dismissedIds.has(a.id));
    if (nextAlert && (!activeAlert || dismissedIds.has(activeAlert.id))) {
      setActiveAlert(nextAlert || null);
    } else if (!nextAlert && activeAlert) {
      setActiveAlert(null);
    }
  }, [alertQueue, activeAlert, dismissedIds]);

  const handleDismiss = () => {
    if (activeAlert) {
      setDismissedIds(prev => new Set([...prev, activeAlert.id]));
      setActiveAlert(null);
    }
  };

  if (!activeAlert || dismissedIds.has(activeAlert.id)) return null;

  const meta = SEVERITY[activeAlert.severity as keyof typeof SEVERITY] || SEVERITY.MEDIUM;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pointer-events-none">
      {/* Full-page dim for CRITICAL */}
      {(activeAlert.severity === 'CRITICAL' || activeAlert.severity === 'HIGH') && (
        <div className="absolute inset-0 bg-red-900/40 pointer-events-auto" onClick={handleDismiss} />
      )}

      {/* Alert Banner */}
      <div className="pointer-events-auto w-full max-w-2xl mt-20 mx-4 slide-in">
        <div className={`rounded-[2rem] p-8 shadow-2xl border-4 ${meta.border} bg-white overflow-hidden relative`}>
          {/* Animated top strip */}
          <div className={`absolute top-0 left-0 right-0 h-2 ${meta.bg}`}>
            {(activeAlert.severity === 'CRITICAL' || activeAlert.severity === 'HIGH') && (
              <div className={`absolute inset-0 ${meta.bg} animate-pulse opacity-50`} />
            )}
          </div>

          <div className="mt-2">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 ${meta.bg} rounded-xl flex items-center justify-center text-white text-xl`}>
                  {activeAlert.severity === 'CRITICAL' ? '🚨' : 
                   activeAlert.severity === 'HIGH' ? '⚠️' : 
                   activeAlert.severity === 'BROADCAST' ? '📢' :
                   activeAlert.severity === 'MEDIUM' ? '⚡' : 'ℹ️'}
                </div>
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${meta.text}`}>{meta.label}</p>
                  {activeAlert.area && <p className="text-slate-500 text-[10px] font-bold uppercase">Area: {activeAlert.area}</p>}
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-slate-400 hover:text-slate-900 font-black text-xl leading-none transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-slate-900 text-xl font-black leading-snug tracking-tight mb-2">{activeAlert.message}</p>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-6">
              {new Date(activeAlert.createdAt).toLocaleString()}
            </p>

            {/* Queue of other alerts */}
            {alertQueue.length > 1 && (
              <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 mb-4">
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-2">{alertQueue.length - 1} More Alert(s)</p>
                {alertQueue.slice(1, 3).map(a => (
                  <button key={a.id} onClick={() => setActiveAlert(a)}
                    className="w-full text-left text-xs font-bold text-slate-600 py-1.5 border-b border-slate-100 last:border-0 hover:text-slate-900 transition-colors truncate">
                    {a.message}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleDismiss}
              className={`w-full py-4 ${meta.bg} text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl hover:opacity-90 active:scale-95 transition-all`}
            >
              Acknowledge & Prepare
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
