'use client';
import { useUser, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useState } from 'react';
import NotificationPanel from '@/components/NotificationPanel';

export default function Navbar() {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const role = user?.publicMetadata?.role as string | undefined;

  const NAV_LINKS = [
    { href: '/first-aid', label: '🚑 First Aid', color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
    { href: '/resources', label: '💧 Resources', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
    { href: '/missing', label: '🔍 Missing', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
    { href: '/sms-sos', label: '📱 SMS SOS', color: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200' },
  ];

  return (
    <nav className="sticky top-0 z-1001 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="w-full px-4 sm:px-10 h-16 flex items-center justify-between">

        {/* LOGO & MOBILE TOGGLE */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden w-10 h-10 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <div className={`w-6 h-0.5 bg-slate-900 transition-all ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <div className={`w-6 h-0.5 bg-slate-900 transition-all ${isMenuOpen ? 'opacity-0' : ''}`} />
            <div className={`w-6 h-0.5 bg-slate-900 transition-all ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
          
          <Link href="/" className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            ResQ<span className="text-red-600">Net</span>
          </Link>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden md:flex items-center gap-2">
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href} className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${link.color}`}>
                {link.label}
              </Link>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-200 hidden md:block" />

          {/* Panic Button */}
          <Link href="/panic"
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-3 sm:px-4 py-2 rounded-full shadow-[0_4px_12px_rgba(239,68,68,0.3)] transition-all active:scale-95 animate-pulse shrink-0">
            <span className="text-sm">🆘</span> Panic
          </Link>

          {isLoaded && user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex items-center gap-3">
                {role === 'VICTIM' && <Link href="/victim/my-sos" className="text-sm font-bold text-slate-700 hover:text-red-600 transition">My SOS</Link>}
                {role === 'VOLUNTEER' && <Link href="/volunteer" className="text-sm font-bold text-slate-700 hover:text-blue-600 transition">Missions</Link>}
                {role === 'NGO' && <Link href="/ngo" className="text-sm font-bold text-slate-700 hover:text-yellow-600 transition">Dashboard</Link>}
              </div>
              
              <NotificationPanel />
              <UserButton />
            </div>
          ) : isLoaded ? null : (
            <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
          )}
        </div>
      </div>

      {/* MOBILE DRAWER */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 bg-white border-b border-slate-200 shadow-xl z-50 animate-in slide-in-from-top duration-300">
          <div className="p-4 space-y-3">
            {isLoaded && user && (
              <div className="flex flex-col gap-2 pb-2 mb-2 border-b border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">My Dashboard</p>
                {role === 'VICTIM' && <Link onClick={() => setIsMenuOpen(false)} href="/victim/my-sos" className="text-sm font-black text-slate-900 hover:text-red-600 p-2 bg-slate-50 rounded-xl">📡 My Active SOS</Link>}
                {role === 'VOLUNTEER' && <Link onClick={() => setIsMenuOpen(false)} href="/volunteer" className="text-sm font-black text-slate-900 hover:text-blue-600 p-2 bg-slate-50 rounded-xl">🚁 My Missions</Link>}
                {role === 'NGO' && <Link onClick={() => setIsMenuOpen(false)} href="/ngo" className="text-sm font-black text-slate-900 hover:text-yellow-600 p-2 bg-slate-50 rounded-xl">🏛 Command Center</Link>}
              </div>
            )}
            
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Resources</p>
            <div className="grid grid-cols-2 gap-2">
              {NAV_LINKS.map(link => (
                <Link key={link.href} href={link.href} onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all text-center ${link.color}`}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
