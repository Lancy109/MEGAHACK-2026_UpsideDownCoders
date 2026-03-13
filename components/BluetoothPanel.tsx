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
    try {
      const stop = await startScanning((packet) => {
        setPackets(prev => [packet, ...prev].slice(0, 5));
        setRelayCount(prev => prev + 1);
        onPacketReceived(packet);
      }, uploadFn);
      stopRef.current = stop;
      setScanning(true);
    } catch (err: any) {
      setError(err.message || 'Bluetooth not supported');
    }
  };

  const handleStop = () => {
    stopRef.current?.();
    stopRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => { stopRef.current?.(); }, []);

  const typeColor: Record<string, string> = {
    FOOD: 'text-yellow-600 bg-yellow-50',
    MEDICAL: 'text-red-600 bg-red-50',
    RESCUE: 'text-blue-600 bg-blue-50',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${scanning ? 'bg-blue-400 animate-pulse' : 'bg-slate-500'}`} />
          <span className="text-white text-xs font-black uppercase tracking-widest">BLE Mesh</span>
        </div>
        {relayCount > 0 && (
          <span className="bg-blue-600/20 text-blue-400 text-[10px] font-black px-2 py-0.5 rounded-full">
            {relayCount} relayed
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {error && (
          <p className="text-red-600 text-[10px] font-bold bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {packets.length > 0 ? (
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {packets.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${typeColor[p.type] || 'text-slate-600 bg-slate-100'}`}>
                  {p.type}
                </span>
                <span className="text-[10px] text-slate-500 font-medium truncate">
                  {p.lat.toFixed(3)}, {p.lng.toFixed(3)}
                </span>
                <span className="text-[9px] text-slate-400 ml-auto">TTL:{p.ttl}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-[10px] text-center py-2 font-medium">
            {scanning ? 'Scanning for nearby SOS...' : 'Start scanning to detect BLE SOS packets'}
          </p>
        )}

        <button
          onClick={scanning ? handleStop : handleStart}
          className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            scanning
              ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              : 'bg-slate-900 text-white hover:bg-slate-700'
          }`}
        >
          {scanning ? 'Stop Scanning' : 'Start BLE Scan'}
        </button>
      </div>
    </div>
  );
}
