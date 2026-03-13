'use client';
import { useState, useEffect } from 'react';

const MOCK_LEADERBOARD = [
  { id: 1, name: 'Aryan Sharma', missions: 24, rating: 4.9, status: 'AVAILABLE' },
  { id: 2, name: 'Sana Shaikh', missions: 18, rating: 4.8, status: 'ON_MISSION' },
  { id: 3, name: 'Vikram Singh', missions: 15, rating: 4.7, status: 'RESTING' },
];

export default function VolunteerLeaderboard() {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-slate-900 font-black text-lg tracking-tight">Volunteer Corps</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none">Global Deployment Rank</p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-emerald-100">
          52 Active
        </div>
      </div>

      <div className="space-y-2">
        {MOCK_LEADERBOARD.map((v, i) => (
          <div key={v.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
             <div className="w-6 text-slate-300 font-black text-xs italic group-hover:text-slate-900 transition-colors">#{i+1}</div>
             <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-400 text-xs shadow-inner">
                {v.name.split(' ').map(n => n[0]).join('')}
             </div>
             <div className="flex-1">
                <p className="text-slate-900 font-bold text-sm tracking-tight">{v.name}</p>
                <div className="flex items-center gap-3">
                   <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{v.missions} Missions</span>
                   <span className="text-amber-500 text-[10px] font-black">★ {v.rating}</span>
                </div>
             </div>
             <div className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${
               v.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
               v.status === 'ON_MISSION' ? 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse' :
               'bg-slate-100 text-slate-400 border-slate-200'
             }`}>
               {v.status.replace('_', ' ')}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
