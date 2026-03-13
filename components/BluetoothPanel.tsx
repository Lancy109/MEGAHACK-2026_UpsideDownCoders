'use client';
import { useState, useEffect, useRef } from 'react';
import { SOSPacket, startScanning, getDeviceId } from '@/lib/bluetooth';

interface BluetoothPanelProps {
  onPacketReceived: (packet: SOSPacket) => void;
}

export default function BluetoothPanel({ onPacketReceived }: BluetoothPanelProps) {
  const [scanning, setScanning]         = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [relayCount, setRelayCount]     = useState(0);
  const [packets, setPackets]           = useState<SOSPacket[]>([]);
  const stopRef = useRef<(() => void) | null>(null);

  const uploadFn = async (packet: SOSPacket) => {
    await fetch('/api/sos/bluetooth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packet, deviceId: getDeviceId() }),
    });
  };

  const handleStart = async () => {
    setError(null);
    setScanning(true);
    try {
      const stop = await startScanning((packet) => {
        setPackets(prev => [packet, ...prev].slice(0, 5));
        setRelayCount(prev => prev + 1);
        onPacketReceived(packet);
      }, uploadFn);
      stopRef.current = stop;
    } catch (err: any) {
      console.warn("BLE scan failed, falling back to simulated packets:", err);
      // Hackathon fallback: Simulate receiving packets if no BLE device found or user cancels
      setError("Hardware BLE not found. Simulating mesh network for demo...");
      
      let count = 0;
      const simTimer = setInterval(() => {
        if (count++ > 2) return; // Simulate max 3 packets
        const simPacket: SOSPacket = {
          id: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: ['FOOD', 'MEDICAL', 'RESCUE'][Math.floor(Math.random() * 3)] as any,
          lat: 19.0760 + (Math.random() - 0.5) * 0.02,
          lng: 72.8777 + (Math.random() - 0.5) * 0.02,
          timestamp: Date.now(),
          ttl: Math.floor(Math.random() * 3) + 2,
          relayCount: Math.floor(Math.random() * 3) + 1,
          originDeviceId: 'sim_device'
        };
        setPackets(prev => [simPacket, ...prev].slice(0, 5));
        setRelayCount(prev => prev + 1);
        onPacketReceived(simPacket);
        uploadFn(simPacket).catch(() => {});
      }, 4000);

      stopRef.current = () => clearInterval(simTimer);
    }
  };

  const handleStop = () => {
    stopRef.current?.();
    stopRef.current = null;
    setScanning(false);
    setError(null);
  };

  useEffect(() => () => { stopRef.current?.(); }, []);

  const typeColor: Record<string, string> = {
    FOOD: 'text-yellow-600 bg-yellow-50',
    MEDICAL: 'text-red-600 bg-red-50',
    RESCUE: 'text-blue-600 bg-blue-50',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-white border border-slate-200 rounded-[2rem] shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${scanning ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-600'}`} />
          <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">BLE Mesh</span>
        </div>
        {relayCount > 0 && (
          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
            {relayCount} Relayed
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3 bg-slate-50">
        {error && (
          <p className="text-amber-700 text-[10px] font-bold bg-amber-100 rounded-xl px-4 py-3 border border-amber-200 uppercase tracking-wide">{error}</p>
        )}

        {packets.length > 0 ? (
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
            {packets.map((p) => (
              <div key={p.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                <span className={`text-[10px] font-black px-2 py-1 rounded-md tracking-wider ${typeColor[p.type] || 'text-slate-600 bg-slate-100'}`}>
                  {p.type}
                </span>
                <span className="text-[10px] text-slate-500 font-bold truncate">
                  {p.lat.toFixed(3)}, {p.lng.toFixed(3)}
                </span>
                <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-md ml-auto">TTL:{p.ttl}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-[10px] text-center py-4 font-bold uppercase tracking-widest">
            {scanning ? 'Scanning for nearby SOS...' : 'Start scanning to detect BLE SOS packets'}
          </p>
        )}

        <button
          onClick={scanning ? handleStop : handleStart}
          className={`w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-sm ${
            scanning
              ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20'
          }`}
        >
          {scanning ? 'Stop Scanning' : 'Start Mesh Upload Node'}
        </button>
      </div>
    </div>
  );
}
