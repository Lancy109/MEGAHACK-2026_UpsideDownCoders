'use client';
import { useState, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import SOSMap from '@/components/SOSMap';
import ResourceTracker from '@/components/ResourceTracker';
import VolunteerLeaderboard from '@/components/VolunteerLeaderboard';

export default function NGODashboard() {
  const [sosList, setSosList] = useState<any[]>([]);
  const [stats, setStats] = useState({
    active: 0,
    medical: 0,
    rescue: 0,
    food: 0,
    voice: 0,
    bluetooth: 0,
  });
  const [showHeatmap, setShowHeatmap] = useState(true);

  useEffect(() => {
    fetch('/api/sos')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSosList(data);
          calculateStats(data);
        }
      });
  }, []);

  useSocket({
    sos_received: (newSOS: any) => {
      setSosList((prev) => {
        const updated = [newSOS, ...prev];
        calculateStats(updated);
        return updated;
      });
    },
    task_update: ({ sosId, status }: { sosId: string; status: string }) => {
      setSosList((prev) => {
        const updated = prev.map((s) => (s.id === sosId ? { ...s, status } : s));
        calculateStats(updated);
        return updated;
      });
    },
  });

  function calculateStats(list: any[]) {
    const active = list.filter((s) => s.status === 'ACTIVE' || s.status === 'ASSIGNED');
    setStats({
      active: active.length,
      medical: active.filter((s) => s.type === 'MEDICAL').length,
      rescue: active.filter((s) => s.type === 'RESCUE').length,
      food: active.filter((s) => s.type === 'FOOD').length,
      voice: active.filter((s) => s.isVoiceSOS).length,
      bluetooth: active.filter((s) => s.source === 'BLUETOOTH').length,
    });
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-slate-50 flex flex-col md:flex-row overflow-hidden">
      
      {/* LEFT PANEL: ANALYTICS & LOGISTICS */}
      <div className="w-full md:w-[400px] flex-shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden shadow-xl z-20">
        <div className="px-6 py-6 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between mb-2">
             <h2 className="text-slate-900 font-black text-2xl tracking-tighter">Mission Control</h2>
             <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
             </div>
          </div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Strategic Oversight Dashboard</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/30">
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
             <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-red-200 transition-colors">
                <div className="absolute -right-2 -bottom-2 text-4xl opacity-[0.03] group-hover:scale-110 transition-transform font-black tracking-tighter">MED</div>
                <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Medical</p>
                <p className="text-red-600 font-black text-2xl tracking-tight">{stats.medical}</p>
             </div>
             <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-colors">
                <div className="absolute -right-2 -bottom-2 text-4xl opacity-[0.03] group-hover:scale-110 transition-transform font-black tracking-tighter">RSC</div>
                <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Rescue</p>
                <p className="text-blue-600 font-black text-2xl tracking-tight">{stats.rescue}</p>
             </div>
             <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-purple-200 transition-colors">
                <div className="absolute -right-2 -bottom-2 text-4xl opacity-[0.03] group-hover:scale-110 transition-transform font-black tracking-tighter">VOC</div>
                <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Voice SOS</p>
                <p className="text-purple-600 font-black text-2xl tracking-tight">{stats.voice}</p>
             </div>
             <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-colors">
                <div className="absolute -right-2 -bottom-2 text-4xl opacity-[0.03] group-hover:scale-110 transition-transform font-black tracking-tighter">BLE</div>
                <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">BLE Mesh</p>
                <p className="text-indigo-600 font-black text-2xl tracking-tight">{stats.bluetooth}</p>
             </div>
          </div>

          <ResourceTracker />
          
          <VolunteerLeaderboard />
          
        </div>
      </div>

      {/* CENTER: TACTICAL MAP */}
      <div className="flex-1 relative flex flex-col">
        <div className="absolute top-6 left-6 right-6 z-10 flex flex-col md:flex-row gap-4 items-start justify-between pointer-events-none">
           <div className="bg-white/80 backdrop-blur-md border border-white p-4 rounded-3xl shadow-2xl pointer-events-auto">
              <div className="flex items-center gap-6">
                 <div>
                    <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest mb-0.5 ml-0.5">Disaster Intensity</p>
                    <div className="flex items-center gap-3">
                       <span className="text-slate-900 font-black text-xl tracking-tighter">Live Heatmap</span>
                       <button 
                         onClick={() => setShowHeatmap(!showHeatmap)}
                         className={`w-10 h-5 rounded-full transition-all relative ${showHeatmap ? 'bg-emerald-500' : 'bg-slate-300'}`}
                       >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${showHeatmap ? 'left-5.5' : 'left-0.5'}`} />
                       </button>
                    </div>
                 </div>
                 <div className="h-8 w-px bg-slate-200" />
                 <div className="text-center">
                    <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest mb-0.5">Global Alerts</p>
                    <p className="text-slate-900 font-black text-xl tracking-tighter">{sosList.length}</p>
                 </div>
              </div>
           </div>
        </div>

        <div className="flex-1 bg-slate-900">
           <SOSMap 
             sosList={sosList} 
             showHeatmap={showHeatmap} 
             zoom={6}
           />
        </div>

        {/* BOTTOM HUD: STATUS TICKER */}
        <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between z-20">
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Uplink Stable</span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div className="overflow-hidden whitespace-nowrap max-w-[300px]">
                <div className="animate-scroll text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {sosList.slice(0,3).map(s => `[NEW SOS: ${s.type} NEAR ${s.lat.toFixed(2)},${s.lng.toFixed(2)}] `).join(' • ')}
                </div>
              </div>
           </div>
           <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tactical OS v4.2</span>
           </div>
        </div>
      </div>

    </div>
  );
}
