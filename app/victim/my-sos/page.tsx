'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useTaskRealtime } from '@/hooks/useTaskRealtime';
import StatusTimeline from '@/components/StatusTimeline';
import LiveChat from '@/components/LiveChat';
import Link from 'next/link';

export default function MySOSPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [activeSOS, setActiveSOS] = useState<any[]>([]);
  const [selectedSosId, setSelectedSosId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && user) {
      const uId = (user?.publicMetadata as any)?.dbId || user?.id;
      fetch(`/api/sos?userId=${uId}`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setActiveSOS(data);
            if (data.length > 0) setSelectedSosId(data[0].id);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isLoaded, user]);

  useTaskRealtime(selectedSosId || '', () => {
    console.log('[Realtime] SOS Status Updated');
  });

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/victim" className="text-slate-500 hover:text-slate-700 font-bold flex items-center gap-2 mb-2">
              ← Back to Emergency Protocol
            </Link>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Track My Active SOS</h1>
          </div>
          <div className="bg-red-50 text-red-600 px-4 py-2 rounded-full border border-red-100 font-black text-xs uppercase tracking-widest">
            {activeSOS.length} ACTIVE SIGNAL{activeSOS.length !== 1 ? 'S' : ''}
          </div>
        </div>

        {activeSOS.length === 0 ? (
          <div className="bg-white rounded-4xl p-12 text-center border-2 border-dashed border-slate-200">
            <div className="text-5xl mb-4">🛡️</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No active SOS signals found.</h2>
            <p className="text-slate-500 mb-6">If you need immediate help, go back and trigger a distress signal.</p>
            <Link href="/victim" className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest hover:bg-red-700 transition-all inline-block shadow-lg">
              SEND SOS NOW
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar: List of active SOS */}
            <div className="lg:col-span-4 space-y-4">
              {activeSOS.map((sos) => (
                <button
                  key={sos.id}
                  onClick={() => setSelectedSosId(sos.id)}
                  className={`w-full text-left p-6 rounded-3xl border-2 transition-all ${
                    selectedSosId === sos.id
                      ? 'bg-white border-red-500 shadow-xl scale-[1.02]'
                      : 'bg-white/50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="bg-red-50 text-red-600 text-[10px] font-black px-3 py-1 rounded-full border border-red-100 uppercase tracking-widest">
                      {sos.type}
                    </span>
                    <span className="text-slate-400 text-[9px] font-black uppercase">
                      {new Date(sos.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-900 font-bold text-sm line-clamp-2 leading-relaxed mb-4">
                    {sos.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${sos.status === 'ASSIGNED' ? 'bg-amber-500' : 'bg-green-500 animate-pulse'}`}></span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {sos.status === 'ASSIGNED' ? 'RESCUE IN PROGRESS' : 'WAITING FOR VOLUNTEER'}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Main Content: Tracking details for selected SOS */}
            <div className="lg:col-span-8 space-y-8">
              {selectedSosId ? (
                <>
                  <StatusTimeline 
                    sosId={selectedSosId} 
                    currentUserId={(user?.publicMetadata as any)?.dbId || user?.id || ''}
                    currentUserName={user?.fullName || user?.username || 'Victim'}
                    showStatusButtons={true}
                  />
                  <div className="bg-white rounded-4xl p-6 border border-slate-200 shadow-sm min-h-[500px] flex flex-col">
                    <h3 className="text-slate-900 font-bold mb-4 px-2">Emergency Communication</h3>
                    <div className="flex-1">
                      <LiveChat 
                        sosId={selectedSosId} 
                        currentUserId={(user?.publicMetadata as any)?.dbId || user?.id || ''}
                        currentUserName={user?.fullName || user?.username || 'Victim'}
                        currentUserRole="VICTIM"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-4xl p-12 text-center border border-slate-200">
                  <p className="text-slate-500 font-bold">Select an active SOS from the list to view its real-time status.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
