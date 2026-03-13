'use client';
import { useState } from 'react';

const INITIAL_RESOURCES = [
  { id: 1, name: 'Medical Kits', qty: 120, unit: 'units', status: 'IN_STOCK', color: 'bg-red-50 text-red-700 border-red-200' },
  { id: 2, name: 'Safe Water', qty: 450, unit: 'liters', status: 'LOW_STOCK', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 3, name: 'Dry Rations', qty: 800, unit: 'kg', status: 'IN_STOCK', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { id: 4, name: 'Rescue Boats', qty: 4, unit: 'vessels', status: 'DEPLOYED', color: 'bg-slate-50 text-slate-700 border-slate-200' },
];

export default function ResourceTracker() {
  const [resources, setResources] = useState(INITIAL_RESOURCES);

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-slate-900 font-black text-lg tracking-tight">Resource Inventory</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none">Live Logistics tracking</p>
        </div>
        <button className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-slate-800 transition-all">
          Update Stock
        </button>
      </div>

      <div className="space-y-3">
        {resources.map((res) => (
          <div key={res.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-slate-300 transition-all group">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${res.color} font-black text-xs`}>
                {res.name[0]}
              </div>
              <div>
                <p className="text-slate-900 font-bold text-sm tracking-tight">{res.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                   <span className={`w-1.5 h-1.5 rounded-full ${res.status === 'LOW_STOCK' ? 'bg-amber-500 animate-pulse' : res.status === 'DEPLOYED' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                   <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{res.status.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-slate-900 font-black text-lg leading-none">{res.qty}</p>
              <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">{res.unit}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
         <div className="flex -space-x-2">
            {[1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white" />)}
            <div className="w-6 h-6 rounded-full bg-slate-900 text-[8px] flex items-center justify-center text-white border-2 border-white font-black">+5</div>
         </div>
         <p className="text-slate-400 text-[9px] font-bold uppercase">Logistics active</p>
      </div>
    </div>
  );
}
