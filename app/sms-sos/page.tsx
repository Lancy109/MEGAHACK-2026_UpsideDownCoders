'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function SMSSOSPage() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const twilioNumber = process.env.NEXT_PUBLIC_TWILIO_DISPLAY_NUMBER || '+91-XXXXX-XXXXX';

  const formats = [
    { cmd: `SOS MEDICAL 19.0760 72.8777`, desc: 'Medical emergency with GPS coordinates', color: 'border-red-200 bg-red-50 text-red-900', label: 'MEDICAL' },
    { cmd: `SOS FOOD 19.0760 72.8777`,    desc: 'Emergency food/water needed with GPS', color: 'border-yellow-200 bg-yellow-50 text-yellow-900', label: 'FOOD' },
    { cmd: `SOS RESCUE 19.0760 72.8777`,  desc: 'Rescue extraction needed with GPS',     color: 'border-blue-200 bg-blue-50 text-blue-900', label: 'RESCUE' },
    { cmd: `HELP`,                         desc: 'Minimal panic signal (last known location)', color: 'border-slate-200 bg-slate-50 text-slate-900', label: 'PANIC' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12 flex flex-col items-center">
      <div className="max-w-4xl w-full bg-white p-8 lg:p-16 rounded-[2.5rem] shadow-xl border border-slate-200">
        <div className="text-center mb-16">
          <div className="w-20 h-20 bg-emerald-50 rounded-full mx-auto flex flex-col items-center justify-center border border-emerald-200 mb-8 shadow-sm">
            <div className="w-2 h-2 bg-emerald-500 rounded-full mb-1 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <div className="w-8 h-1 bg-emerald-500 rounded-full" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-slate-900 mb-4 tracking-tighter uppercase">ZERO-INTERNET SOS</h1>
          <p className="text-slate-500 text-base md:text-lg font-bold">Broadcast emergency alerts via SMS when cellular data is unavailable</p>
        </div>

        <div className="bg-red-50 border-2 border-red-100 rounded-[2rem] p-10 lg:p-12 text-center mb-16 shadow-inner relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-8xl font-black tracking-tighter italic group-hover:scale-110 transition-transform text-red-900">SMS</div>
          <p className="text-red-600 text-[10px] uppercase font-black tracking-[0.3em] mb-4">Priority Uplink Number</p>
          <p className="text-red-700 font-black text-4xl md:text-6xl tracking-widest mb-6 drop-shadow-sm">{twilioNumber}</p>
          <div className="flex items-center justify-center gap-3">
             <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
             <p className="text-red-600 text-xs font-bold uppercase tracking-widest">Standard SMS rates apply — 100% Offline Resilience</p>
          </div>
        </div>

        <h2 className="text-slate-900 font-black text-xl uppercase tracking-widest mb-8 px-4 border-l-4 border-slate-900 py-1">Formats to Copy</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {formats.map((f, i) => (
            <div key={i} className={`border-2 ${f.color} rounded-[2rem] p-8 transition-all hover:scale-[1.02] group shadow-sm flex flex-col justify-between`}>
              <div>
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-4 block">{f.label} Protocol</span>
                 <code className="block font-mono text-xl md:text-2xl font-black tracking-tight mb-4 break-words">{f.cmd}</code>
                 <p className="text-sm font-bold opacity-80 mb-8">{f.desc}</p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(f.cmd);
                  setCopiedIndex(i);
                  setTimeout(() => setCopiedIndex(null), 2000);
                }}
                className={`w-full text-xs font-black uppercase tracking-widest px-6 py-4 rounded-xl transition-all ${
                  copiedIndex === i 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105' 
                    : 'bg-white bg-opacity-50 hover:bg-white border-2 border-transparent hover:border-current hover:shadow-md'
                }`}>
                {copiedIndex === i ? '✓ COPIED TO CLIPBOARD' : 'COPY MESSAGE'}
              </button>
            </div>
          ))}
        </div>

        <div className="bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-10 mb-12 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-8xl font-black italic tracking-tighter text-slate-900 transition-transform group-hover:scale-110">GPS</div>
          <h3 className="text-slate-900 font-black text-base md:text-lg uppercase tracking-widest mb-8 flex items-center gap-3 relative z-10 w-fit border-b-2 border-slate-200 pb-2">
             <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse shadow-sm shadow-blue-500/50" />
             How to add your GPS location
          </h3>
          <ul className="space-y-6 relative z-10">
            <li className="flex gap-5 items-start">
               <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-900 font-black text-sm shadow-sm">1</div>
               <p className="text-slate-600 text-base font-bold pt-2">Open Google Maps (or any map app) and tap your current location dot.</p>
            </li>
            <li className="flex gap-5 items-start">
               <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-900 font-black text-sm shadow-sm">2</div>
               <p className="text-slate-600 text-base font-bold pt-2">Copy the decimal coordinates (like <code className="bg-slate-200 px-2 py-1 rounded text-slate-900">19.0762, 72.8777</code>) from the screen.</p>
            </li>
            <li className="flex gap-5 items-start">
               <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-900 font-black text-sm shadow-sm">3</div>
               <p className="text-slate-600 text-base font-bold pt-2">Paste those numbers into your text message before sending.</p>
            </li>
          </ul>
        </div>

        <div className="bg-amber-50 border-2 border-amber-200 rounded-[2rem] p-8 md:p-10 flex flex-col md:flex-row gap-6 items-start shadow-sm">
           <div className="w-12 h-12 rounded-full bg-amber-100 flex flex-col items-center justify-center border border-amber-300 flex-shrink-0">
              <div className="w-1.5 h-3 bg-amber-600 rounded-full mb-1" />
              <div className="w-1.5 h-1.5 bg-amber-600 rounded-full" />
           </div>
           <div>
              <p className="text-amber-700 font-black text-base uppercase tracking-widest mb-2">PRO-TIP: SAVE NOW</p>
              <p className="text-amber-800/80 text-sm font-bold leading-relaxed max-w-2xl">
                 Save the ResQNet Priority number in your contacts right now as "!! RESQNET SOS". 
                 SMS signals can penetrate areas with zero data coverage where standard apps fail completely.
              </p>
           </div>
        </div>

        <div className="mt-16 text-center">
           <Link href="/" className="text-slate-400 hover:text-slate-900 transition-colors text-xs font-black uppercase tracking-[0.4em]">
             ← Back to Base
           </Link>
        </div>
      </div>
    </div>
  );
}
