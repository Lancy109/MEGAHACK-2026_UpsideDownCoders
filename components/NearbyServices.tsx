'use client';
import { useState, useEffect, useRef } from 'react';
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
  const cacheRef = useRef<Record<string, any[]>>({});
  const lastFetchRef = useRef<{ lat: number; lng: number; type: string } | null>(null);

  // Helper to calculate distance for threshold check
  const getDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  useEffect(() => {
    if (!lat || !lng) return;

    // 1. Instant Cache Load
    const cacheKey = `${activeType}`;
    if (cacheRef.current[cacheKey]) {
      setPlaces(cacheRef.current[cacheKey]);
    }

    // 2. Threshold Check: Only fetch if moved > 200m or type changed
    const moved = lastFetchRef.current 
      ? getDist(lat, lng, lastFetchRef.current.lat, lastFetchRef.current.lng) > 200 
      : true;
    const typeChanged = lastFetchRef.current?.type !== activeType;

    if (!moved && !typeChanged) return;

    // 3. Debounced Fetch
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/nearby?lat=${lat}&lng=${lng}&type=${activeType}`)
        .then(r => r.json())
        .then(data => {
          const results = Array.isArray(data) ? data : [];
          setPlaces(results);
          cacheRef.current[cacheKey] = results;
          lastFetchRef.current = { lat, lng, type: activeType };
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [lat, lng, activeType]);

  if (!lat || !lng) return null;

  return (
    <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-y-4 mb-8 border-b-2 border-slate-100 pb-4">
        <h3 className="text-slate-900 font-black text-sm uppercase tracking-widest flex items-center gap-3">
           <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
           Nearby Emergency Units
        </h3>
        <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
           <span>RADIUS <span className="text-blue-600">10KM</span></span>
           <span className="w-px h-3 bg-slate-300" />
           <span>LOC <span className="text-slate-900 font-mono tracking-tight">{lat.toFixed(3)}, {lng.toFixed(3)}</span></span>
        </div>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 custom-scrollbar">
        {SERVICE_TYPES.map(s => (
          <button key={s.type} onClick={() => setActiveType(s.type)}
            className={`flex-shrink-0 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all active:scale-95 ${
              activeType === s.type
                ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300 hover:text-slate-600'
            }`}>
            <span className="opacity-70 mr-2">{s.icon}</span> <span>{s.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-slate-50 rounded-2xl h-24 animate-pulse border border-slate-200" />
          ))}
        </div>
      ) : places.length === 0 ? (
        <div className="bg-slate-50 rounded-[2rem] py-16 flex flex-col items-center justify-center border-2 border-dashed border-slate-200">
           <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">No vetted facilities found nearby</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {places.map(p => (
            <div key={p.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between transition-all hover:bg-white hover:shadow-md group gap-4">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-3 mb-2">
                   <p className="text-slate-900 text-base font-black leading-tight">{p.name}</p>
                   {p.isOpen && <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase px-2.5 py-1 rounded-md border border-emerald-200">Open Now</span>}
                </div>
                <p className="text-slate-500 text-xs font-bold line-clamp-1">{p.address || 'Location data unavailable'}</p>
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-blue-700 text-[10px] font-black font-mono tracking-widest py-1 px-2.5 border border-blue-200 bg-blue-50 rounded-md">{p.distance.toFixed(1)} KM</span>
                  {p.rating && <span className="text-amber-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">RATING: {p.rating}/5</span>}
                </div>
              </div>
              <a href={getDirectionsURL(p.lat, p.lng)} target="_blank" rel="noreferrer"
                className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-[0.2em] px-6 py-4 rounded-xl transition-all active:scale-95 shadow-md shadow-slate-900/10 text-center w-full md:w-auto">
                Directions
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
