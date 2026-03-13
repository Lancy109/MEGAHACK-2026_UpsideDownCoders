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
  }, [volunteerLoc, victimLoc]);

  if (!volunteerLoc) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mt-4 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-6 opacity-10 text-4xl group-hover:scale-110 transition-transform">⏱️</div>
      
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20">
          <span className="text-xl">🚀</span>
        </div>
        <div>
          <h3 className="text-white font-black text-sm uppercase tracking-tighter">Tactical ETA</h3>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-none">Real-time response tracking</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-12 bg-slate-800 animate-pulse rounded-2xl border border-white/5" />
          <div className="flex gap-3">
             <div className="flex-1 h-8 bg-slate-800 animate-pulse rounded-xl border border-white/5" />
             <div className="flex-1 h-8 bg-slate-800 animate-pulse rounded-xl border border-white/5" />
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-4 text-center">
          <p className="text-red-400 text-[10px] font-black uppercase tracking-widest">Routing Link Failed</p>
        </div>
      ) : data ? (
        <div className="slide-in">
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-white font-black text-4xl tracking-tighter">{data.duration}</span>
            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">TO TARGET</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
             <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
               <p className="text-slate-500 text-[8px] font-black uppercase tracking-[0.2em] mb-1">Distance</p>
               <p className="text-white font-black text-lg tracking-tight">{data.distance}</p>
             </div>
             <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
               <p className="text-slate-500 text-[8px] font-black uppercase tracking-[0.2em] mb-1">Via</p>
               <p className="text-white font-black text-sm tracking-tight truncate">{data.summary || 'Optimal'}</p>
             </div>
          </div>

          <div className="bg-blue-600/5 border border-blue-600/20 rounded-2xl p-4 flex items-center justify-between group/status">
             <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                <span className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">Interception Optimal</span>
             </div>
             <div className="flex gap-1">
                {[1,2,3].map(i => <div key={i} className="w-1 h-3 bg-blue-500/20 rounded-full group-hover/status:bg-blue-500 transition-colors" style={{ transitionDelay: `${i*100}ms` }} />)}
             </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
