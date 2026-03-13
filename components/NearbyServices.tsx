'use client';
import { useState, useEffect } from 'react';
import { getDirectionsURL } from '@/utils/gps';

const SERVICE_TYPES = [
  { type: 'hospital',     label: 'Hospitals', icon: 'MED', color: 'bg-red-500/10 text-red-500'    },
  { type: 'police',       label: 'Police',    icon: 'POL', color: 'bg-blue-500/10 text-blue-500'   },
  { type: 'fire_station', label: 'Fire Dept', icon: 'FIR', color: 'bg-orange-500/10 text-orange-500' },
  { type: 'pharmacy',     label: 'Pharmacy',  icon: 'PHR', color: 'bg-emerald-500/10 text-emerald-500'  },
];

export default function NearbyServices({ lat, lng }: { lat?: number; lng?: number }) {
  const [activeType, setActiveType] = useState('hospital');
  const [places, setPlaces]         = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    if (!lat || !lng) return;
    setLoading(true);
    fetch(`/api/nearby?lat=${lat}&lng=${lng}&type=${activeType}`)
      .then(r => r.json())
      .then(data => { setPlaces(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [lat, lng, activeType]);

  if (!lat || !lng) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mt-6 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-y-2 mb-6 border-b border-slate-800 pb-4">
        <h3 className="text-white font-black text-sm uppercase tracking-tighter flex items-center gap-3">
           <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
           Nearby Emergency Units
        </h3>
        <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
           <span>RADIUS: <span className="text-blue-400">10KM</span></span>
           <span>LOC: <span className="text-white font-mono">{lat.toFixed(3)},{lng.toFixed(3)}</span></span>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 no-scrollbar">
        {SERVICE_TYPES.map(s => (
          <button key={s.type} onClick={() => setActiveType(s.type)}
            className={`flex-shrink-0 px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${
              activeType === s.type
                ? 'bg-blue-600/20 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                : 'bg-slate-800 border-transparent text-slate-400 hover:border-slate-600'
            }`}>
            <span className="text-[9px] opacity-60 mr-1.5">{s.icon}</span> <span>{s.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-slate-800/50 rounded-2xl h-24 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : places.length === 0 ? (
        <div className="bg-black/20 rounded-2xl py-12 flex flex-col items-center justify-center border border-dashed border-slate-800">
           <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">No vetted facilities found nearby</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {places.map(p => (
            <div key={p.id} className="bg-slate-800/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all hover:bg-slate-800/60 group">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1">
                   <p className="text-white text-sm font-black leading-tight">{p.name}</p>
                   {p.isOpen && <span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-500/20">Open Now</span>}
                </div>
                <p className="text-slate-500 text-xs font-medium line-clamp-1">{p.address || 'Location data unavailable'}</p>
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-blue-300 text-[10px] font-black font-mono tracking-widest py-1 px-2 border border-blue-400/30 bg-blue-900/40 rounded">{p.distance.toFixed(1)} KM</span>
                  {p.rating && <span className="text-yellow-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">RATING: {p.rating}/5</span>}
                </div>
              </div>
              <a href={getDirectionsURL(p.lat, p.lng)} target="_blank" rel="noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest px-5 py-3 rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-900/20 group-hover:scale-105">
                Directions
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
