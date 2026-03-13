'use client';
import { useUser, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const role = user?.publicMetadata?.role as string | undefined;
  const isSelectionPage = pathname === '/user-type';

  return (
    <nav className="sticky top-0 z-[1001] bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="w-full px-6 sm:px-10 h-16 flex items-center justify-between">

        {/* LOGO */}
        <div className="flex items-center">
          <Link href="/" className="text-2xl font-black text-slate-900 tracking-tight">
            ResQ<span className="text-red-600">Net</span>
          </Link>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-6">
            <div className="flex items-center gap-2">
            </div>
            <Link href="/sms-sos" className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-full border border-slate-200 text-[10px] font-black uppercase tracking-widest transition-all">
              📱 SMS SOS
            </Link>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          {/* SOS Shortcut */}
          <Link href="/panic"
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-[0_4px_12px_rgba(239,68,68,0.3)] transition-all active:scale-95 animate-pulse">
            <span className="text-sm">🆘</span> Panic
          </Link>

          {isLoaded && user ? (
            <div className="flex items-center gap-4">
              {role === 'VICTIM' && <Link href="/victim" className="text-sm font-bold text-slate-700 hover:text-red-600 transition">My SOS</Link>}
              {role === 'VOLUNTEER' && <Link href="/volunteer" className="text-sm font-bold text-slate-700 hover:text-blue-600 transition">Missions</Link>}
              {role === 'NGO' && <Link href="/ngo" className="text-sm font-bold text-slate-700 hover:text-yellow-600 transition">Dashboard</Link>}
              <UserButton />
            </div>
          ) : isLoaded ? null : (
            <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
          )}
        </div>

      </div>
    </nav>
  );
}
