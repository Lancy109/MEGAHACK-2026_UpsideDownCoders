'use client';
import { useEffect, useState } from 'react';
import { SOSPacket } from '@/lib/bluetooth';

interface Props {
  packet: SOSPacket;
  onDismiss: () => void;
}

export default function BluetoothSOSAlert({ packet, onDismiss }: Props) {
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); onDismiss(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onDismiss]);

  const typeConfig: Record<string, { label: string; color: string; border: string }> = {
    FOOD:    { label: 'Food & Water',  color: 'text-yellow-700 bg-yellow-50', border: 'border-yellow-300' },
    MEDICAL: { label: 'Medical Help',  color: 'text-red-700 bg-red-50',       border: 'border-red-300' },
    RESCUE:  { label: 'Rescue Needed', color: 'text-blue-700 bg-blue-50',     border: 'border-blue-300' },
  };
  const cfg = typeConfig[packet.type] || typeConfig.RESCUE;

  const handleNavigate = () => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${packet.lat},${packet.lng}`, '_blank');
    onDismiss();
  };

  const handleAccept = async () => {
    try {
      await fetch('/api/sos/bluetooth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packet, accept: true }),
      });
    } catch { /* ignore */ }
    onDismiss();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] flex justify-center pt-4 px-4 animate-in slide-in-from-top duration-300">
      <div className={`bg-white border-2 ${cfg.border} rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden`}>
        {/* Progress bar countdown */}
        <div className="h-1 bg-slate-100 relative overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-1000 ease-linear"
            style={{ width: `${(countdown / 30) * 100}%` }}
          />
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">
                Bluetooth SOS — {packet.relayCount} hop{packet.relayCount !== 1 ? 's' : ''}
              </p>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
            </div>
            <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
          </div>

          <p className="text-slate-700 text-sm font-medium mb-1">
            Location: {packet.lat.toFixed(4)}, {packet.lng.toFixed(4)}
          </p>
          <p className="text-slate-400 text-[10px] mb-4">
            Auto-dismisses in {countdown}s
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              className="flex-1 bg-slate-900 hover:bg-slate-700 text-white text-xs font-black py-3 rounded-xl transition-all"
            >
              Accept
            </button>
            <button
              onClick={handleNavigate}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-3 rounded-xl transition-all"
            >
              Navigate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
