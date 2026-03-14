'use client';
import { useUser, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ... existing imports
import NotificationPanel from '@/components/NotificationPanel';

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
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <Link href="/first-aid" className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all">
              🚑 First Aid
            </Link>
            <Link href="/resources" className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all">
              💧 Resources
            </Link>
            <Link href="/missing" className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all">
              🔍 Missing
            </Link>
            <Link href="/sms-sos" className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 px-3 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all">
              📱 SMS SOS
            </Link>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden md:block" />

          {/* Panic Button */}
          <Link href="/panic"
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-[0_4px_12px_rgba(239,68,68,0.3)] transition-all active:scale-95 animate-pulse">
            <span className="text-sm">🆘</span> Panic
          </Link>

          {isLoaded && user ? (
            <div className="flex items-center gap-3">
              {role === 'VICTIM' && <Link href="/victim" className="text-sm font-bold text-slate-700 hover:text-red-600 transition">My SOS</Link>}
              {role === 'VOLUNTEER' && <Link href="/volunteer" className="text-sm font-bold text-slate-700 hover:text-blue-600 transition">Missions</Link>}
              {role === 'NGO' && <Link href="/ngo" className="text-sm font-bold text-slate-700 hover:text-yellow-600 transition">Dashboard</Link>}
              
              {/* Notifications Panel */}
              <NotificationPanel />

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
