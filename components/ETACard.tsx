'use client';
import { useState, useEffect } from 'react';

export interface ETACardProps {
  volunteerLoc: { lat: number; lng: number } | null;
  victimLoc: { lat: number; lng: number };
  sosId: string;
}

export default function ETACard({ volunteerLoc, victimLoc, sosId }: ETACardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!volunteerLoc || !victimLoc) return;

    // Throttle location updates by rounding to 3 decimal places (approx 111 meters)
    // This prevents GPS micro-jitters from causing an infinite loading screen loop
    const roundedLat = volunteerLoc.lat.toFixed(3);
    const roundedLng = volunteerLoc.lng.toFixed(3);
    const key = `${roundedLat},${roundedLng}`;

    // If the location hasn't materially changed, don't refetch
    setLoading(true);
    fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin: volunteerLoc, destination: victimLoc }),
    })
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(true);
        else setData(res);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [volunteerLoc?.lat.toFixed(3), volunteerLoc?.lng.toFixed(3), victimLoc?.lat, victimLoc?.lng]);

  if (!volunteerLoc) return null;

  return (
    <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-6 mt-6 shadow-none relative overflow-hidden group">
      
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center border border-blue-200">
          <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse shadow-sm" />
        </div>
        <div>
          <h3 className="text-slate-900 font-black text-sm uppercase tracking-widest">Tactical ETA</h3>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-none mt-1">Real-time response tracking</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-12 bg-white animate-pulse rounded-2xl border border-slate-200" />
          <div className="flex gap-3">
             <div className="flex-1 h-8 bg-white animate-pulse rounded-xl border border-slate-200" />
             <div className="flex-1 h-8 bg-white animate-pulse rounded-xl border border-slate-200" />
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <p className="text-red-700 text-[10px] font-black uppercase tracking-widest">Routing Link Failed</p>
        </div>
      ) : data ? (
        <div className="slide-in">
          <div className="flex items-baseline gap-3 mb-5">
            <span className="text-slate-900 font-black text-4xl tracking-tight">{data.duration}</span>
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">TO TARGET</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
             <div className="bg-white border text-center border-slate-200 rounded-2xl p-4 shadow-sm">
               <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] mb-1">Distance</p>
               <p className="text-slate-900 font-black text-lg tracking-tight">{data.distance}</p>
             </div>
             <div className="bg-white border text-center border-slate-200 rounded-2xl p-4 shadow-sm">
               <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] mb-1">Via</p>
               <p className="text-slate-900 font-black text-sm tracking-tight truncate">{data.summary || 'Optimal'}</p>
             </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between group/status">
             <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                <span className="text-blue-700 text-[10px] font-black uppercase tracking-[0.2em]">Interception Optimal</span>
             </div>
             <div className="flex gap-1">
                {[1,2,3].map(i => <div key={i} className="w-1.5 h-3 bg-blue-200 rounded-full group-hover/status:bg-blue-500 transition-colors" style={{ transitionDelay: `${i*100}ms` }} />)}
             </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
