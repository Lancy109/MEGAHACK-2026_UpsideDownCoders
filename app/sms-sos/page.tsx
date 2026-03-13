'use client';
import Link from 'next/link';

export default function SMSSOSPage() {
  const twilioNumber = process.env.NEXT_PUBLIC_TWILIO_DISPLAY_NUMBER || '+91-XXXXX-XXXXX';

  const formats = [
    { cmd: `SOS MEDICAL 19.0760 72.8777`, desc: 'Medical emergency with GPS coordinates', color: 'border-red-900/50 bg-red-950/20' },
    { cmd: `SOS FOOD 19.0760 72.8777`,    desc: 'Emergency food/water needed with GPS', color: 'border-yellow-900/50 bg-yellow-950/20' },
    { cmd: `SOS RESCUE 19.0760 72.8777`,  desc: 'Rescue extraction needed with GPS',     color: 'border-blue-900/50 bg-blue-950/20' },
    { cmd: `HELP`,                         desc: 'Minimal panic signal (last known location)', color: 'border-slate-800 bg-slate-900/50' },
  ];

  return (
    <div className="min-h-screen bg-black px-6 py-12 flex flex-col items-center">
      <div className="max-w-xl w-full">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-emerald-600/10 rounded-2xl mx-auto flex flex-col items-center justify-center border border-emerald-600/20 mb-8 shadow-[0_0_15px_rgba(5,150,105,0.2)]">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mb-1 animate-pulse" />
            <div className="w-6 h-0.5 bg-emerald-500/50 rounded-full" />
          </div>
          <h1 className="text-4xl font-black text-white mb-3 tracking-widest uppercase">ZERO-INTERNET SOS</h1>
          <p className="text-slate-500 text-sm font-medium">Broadcast emergency alerts via SMS when cellular data is unavailable</p>
        </div>

        <div className="bg-red-600 rounded-[2.5rem] p-10 text-center mb-12 shadow-[0_0_80px_rgba(239,68,68,0.2)]">
          <p className="text-red-100 text-[10px] uppercase font-black tracking-[0.3em] mb-3">Priority Uplink Number</p>
          <p className="text-white font-black text-4xl md:text-5xl tracking-widest mb-4">{twilioNumber}</p>
          <div className="flex items-center justify-center gap-2">
             <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
             <p className="text-red-200 text-xs font-bold">Standard SMS rates apply — 100% Offline Resilience</p>
          </div>
        </div>

        <h2 className="text-white font-black text-sm uppercase tracking-widest mb-6 px-4">Tactical Commands</h2>
        <div className="grid grid-cols-1 gap-4 mb-12">
          {formats.map((f, i) => (
            <div key={i} className={`border-2 ${f.color} rounded-2xl p-6 transition-all hover:scale-[1.02] group relative overflow-hidden`}>
              <div className="absolute top-0 right-0 p-4 opacity-5 text-4xl font-black italic">RESQNET</div>
              <div className="flex items-center justify-between mb-2">
                <code className="text-white font-mono text-lg font-black tracking-tight">{f.cmd}</code>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(f.cmd);
                    alert('Command copied to clipboard');
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all">
                  Copy
                </button>
              </div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 mb-8 shadow-inner">
          <h3 className="text-white font-black text-sm uppercase tracking-widest mb-6 flex items-center gap-3">
             <span className="w-2 h-2 bg-blue-500 rounded-full" />
             How to extract GPS coordinates
          </h3>
          <ul className="space-y-4">
            <li className="flex gap-4">
               <span className="text-slate-700 font-black text-lg leading-none">01</span>
               <p className="text-slate-400 text-sm font-medium">Open Google Maps and long-press your blue location dot.</p>
            </li>
            <li className="flex gap-4">
               <span className="text-slate-700 font-black text-lg leading-none">02</span>
               <p className="text-slate-400 text-sm font-medium">Copy the decimal coordinates (e.g., 19.0762, 72.8777) from the search bar.</p>
            </li>
            <li className="flex gap-4">
               <span className="text-slate-700 font-black text-lg leading-none">03</span>
               <p className="text-slate-400 text-sm font-medium">Paste them into your SMS after the emergency type.</p>
            </li>
          </ul>
        </div>

        <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-3xl p-8 flex gap-6 items-start">
           <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex flex-col items-center justify-center border border-yellow-500/30 flex-shrink-0">
              <div className="w-1 h-2 bg-yellow-500 rounded-full mb-0.5" />
              <div className="w-1 h-1 bg-yellow-500 rounded-full" />
           </div>
           <div>
              <p className="text-yellow-500 font-black text-sm uppercase tracking-tighter mb-1">PRO-TIP: SAVE NOW</p>
              <p className="text-yellow-600/80 text-xs font-semibold leading-relaxed">
                 Save the ResQNet Priority number in your contacts now as "!! RESQNET SOS". 
                 SMS signals can penetrate areas with zero data coverage where apps fail.
              </p>
           </div>
        </div>

        <div className="mt-12 text-center">
           <Link href="/" className="text-slate-600 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.4em]">
             ← Back to Base
           </Link>
        </div>
      </div>
    </div>
  );
}
