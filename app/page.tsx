'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';

export default function Home() {
  const [sosCount, setSosCount] = useState(0);

  useEffect(() => {
    fetch('/api/sos?all=true')
      .then((r) => r.json())
      .then((data) => setSosCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});
  }, []);

  const { user, isLoaded } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-slate-50">

      {/* HERO */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 lg:px-12 py-24 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200 w-full">
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-2 rounded-full text-xs font-black uppercase tracking-[0.2em] mb-8 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          {sosCount} Emergencies Handled
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 tracking-tight mb-8 w-full max-w-7xl mx-auto leading-tight">
          When disaster strikes, <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-500">
            every second counts.
          </span>
        </h1>

        <p className="text-lg md:text-2xl text-slate-500 mb-12 w-full max-w-4xl mx-auto font-medium leading-relaxed">
          A real-time coordination platform connecting victims with nearby volunteers and NGOs instantly using advanced AI analysis and geospatial routing.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-3xl mx-auto">
          {!isLoaded ? (
             <div className="w-48 h-12 bg-slate-200 animate-pulse rounded-xl" />
          ) : user ? (
            <>
              {role === 'VICTIM' && (
                <Link href="/victim" className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black px-8 py-5 rounded-2xl text-lg transition-all shadow-xl shadow-red-500/30 hover:-translate-y-1 uppercase tracking-widest text-center">
                  Get Help Now (SOS)
                </Link>
              )}
              {role === 'VOLUNTEER' && (
                <Link href="/volunteer" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-5 rounded-2xl text-lg transition-all shadow-xl shadow-blue-500/30 hover:-translate-y-1 uppercase tracking-widest text-center">
                  Go to Missions
                </Link>
              )}
              {role === 'NGO' && (
                <Link href="/ngo" className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-black px-8 py-5 rounded-2xl text-lg transition-all shadow-xl shadow-slate-900/30 hover:-translate-y-1 uppercase tracking-widest text-center">
                  Command Center
                </Link>
              )}
              {!role && (
                <Link href="/user-type" className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-black px-8 py-5 rounded-2xl text-lg transition-all shadow-xl shadow-slate-900/30 hover:-translate-y-1 uppercase tracking-widest text-center flex items-center justify-center gap-2">
                  Finish Your Profile <span className="text-xl leading-none">→</span>
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                href="/auth/signup"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black px-8 py-5 rounded-2xl text-lg transition-all shadow-xl shadow-red-500/30 hover:-translate-y-1 uppercase tracking-widest text-center"
              >
                Sign Up
              </Link>
              <Link
                href="/auth/login"
                className="flex-1 bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-200 hover:border-slate-300 font-black px-8 py-5 rounded-2xl text-lg transition-all shadow-sm uppercase tracking-widest text-center"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 bg-white px-6 w-full">
        <div className="max-w-7xl mx-auto w-full">
          <h2 className="text-4xl font-black text-center text-slate-900 mb-16 uppercase tracking-tight">
            How ResQ<span className="text-red-600">Net</span> Operates
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            {[
              { icon: '01', title: 'Victim requests SOS', desc: 'Victims post their emergency type and exact GPS location in seconds.' },
              { icon: '02', title: 'AI assesses priority', desc: 'Groq LPU provides immediate first-aid advice and categorizes the urgency.' },
              { icon: '03', title: 'Volunteers dispatched', desc: 'Nearby volunteers and NGOs are notified instantly via WebSockets and SMS.' },
              { icon: '04', title: 'No Internet? Use SMS', desc: 'Send "SOS MEDICAL 19.07 72.87" to our dedicated number. Works on any phone.', link: '/sms-sos' },
            ].map((step, i) => (
              <div key={i} className={`bg-slate-50 border border-slate-200 p-8 rounded-3xl text-left hover:shadow-xl transition-all hover:-translate-y-1 flex flex-col ${step.link ? 'border-purple-200 bg-purple-50/30' : ''}`}>
                <div className="text-5xl font-black text-slate-300/50 mb-6 font-mono tracking-tighter">{step.icon}</div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 leading-tight">{step.title}</h3>
                <p className="text-slate-500 text-sm mb-4 flex-1 leading-relaxed font-medium">{step.desc}</p>
                {step.link && (
                  <Link href={step.link} className="text-purple-600 font-black text-[10px] uppercase tracking-widest hover:underline mt-auto">
                    View SMS Instructions →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 text-slate-400 py-12 text-center text-sm font-medium">
        <p className="mb-2 font-black text-white uppercase tracking-widest text-xs">MegaHack 6.0 Project</p>
        <p>Built with Next.js 15, Clerk, Socket.io, Prisma, & Groq LPU</p>
      </footer>
    </div>
  );
}
