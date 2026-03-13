'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useSocket } from '@/hooks/useSocket';
import SOSCard from '@/components/SOSCard';
import SOSMap from '@/components/SOSMap';
import LiveChat from '@/components/LiveChat';
import ETACard from '@/components/ETACard';

export default function VolunteerPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && user && !user.publicMetadata?.role) {
      router.replace('/user-type');
    }
  }, [isLoaded, user, router]);
  const [sosList, setSosList]         = useState<any[]>([]);
  const [acceptedMap, setAcceptedMap] = useState<Record<string, boolean>>({});
  const [taskMap, setTaskMap]         = useState<Record<string, string>>({});
  const [userLoc, setUserLoc]         = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.warn('Location watch failed:', err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    const fetchMissions = async () => {
      // 1. Fetch all active/assigned SOS alerts
      const resSOS = await fetch('/api/sos');
      const dataSOS = await resSOS.json();
      if (Array.isArray(dataSOS)) setSosList(dataSOS);

      // 2. Fetch my existing tasks to resume state
      const dbId = (user?.publicMetadata as any)?.dbId;
      const clerkId = user?.id;
      const uid = dbId || clerkId;
      
      if (uid) {
        const resTasks = await fetch(`/api/tasks?volunteerId=${uid}`);
        const dataTasks = await resTasks.json();
        if (Array.isArray(dataTasks)) {
          const accMap: Record<string, boolean> = {};
          const tMap: Record<string, string> = {};
          dataTasks.forEach((t: any) => {
            accMap[t.sosId] = true;
            tMap[t.sosId] = t.id;
          });
          setAcceptedMap(accMap);
          setTaskMap(tMap);
        }
      }
    };

    if (isLoaded) fetchMissions();
  }, [isLoaded, user]);

  useSocket({
    sos_received: (newSOS: any) => {
      setSosList((prev) => {
        if (prev.find((s) => s.id === newSOS.id)) return prev;
        return [newSOS, ...prev];
      });
    },
    task_update: ({ sosId, status }: { sosId: string, status: string }) => {
      setSosList((prev) => prev.map((s) => s.id === sosId ? { ...s, status } : s));
    },
    sos_resolved: ({ sosId }: { sosId: string }) => {
      setSosList((prev) => prev.filter((s) => s.id !== sosId));
    },
  });

  async function handleAccept(sosId: string) {
    const dbId = (user?.publicMetadata as any)?.dbId || user?.id;
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sosId, volunteerId: dbId }),
    });
    const data = await res.json();
    if (res.ok) {
      setAcceptedMap((prev) => ({ ...prev, [sosId]: true }));
      setTaskMap((prev) => ({ ...prev, [sosId]: data.id }));
    } else {
      alert(data.error || 'Could not accept task');
    }
  }

  async function handleComplete(sosId: string) {
    const taskId = taskMap[sosId];
    if (!taskId) return;
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    });
    setSosList((prev) => prev.filter((s) => s.id !== sosId));
    setAcceptedMap((prev) => { const n = { ...prev }; delete n[sosId]; return n; });
  }

  const activeSOS = sosList.filter((s) => s.status !== 'RESOLVED' && !acceptedMap[s.id]);
  const myTasks   = sosList.filter((s) => acceptedMap[s.id]);

  return (
    <div className="h-[calc(100vh-4rem)] bg-slate-50 flex overflow-hidden">

      {/* LEFT PANEL */}
      <div className="w-full md:w-[450px] flex-shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden shadow-xl z-10">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white shadow-sm">
          <h2 className="text-slate-900 font-black text-xl tracking-tight">Mission Board</h2>
          <span className="bg-red-50 border border-red-200 text-red-600 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            {activeSOS.length} Live Alerts
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50/50">
          {myTasks.length > 0 && (
            <div className="mb-6">
              <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-3 px-2 flex items-center gap-2">
                <span className="w-full h-px bg-emerald-200 flex-1"></span>
                My Active Missions
                <span className="w-full h-px bg-emerald-200 flex-1"></span>
              </p>
              {myTasks.map((sos) => (
                <div key={sos.id} className="slide-in">
                  <SOSCard 
                    sos={sos} 
                    onAccept={async () => {}} 
                    isAccepted 
                    taskId={taskMap[sos.id]} 
                    userLocation={userLoc}
                  >
                    <ETACard 
                      volunteerLoc={userLoc} 
                      victimLoc={{ lat: sos.lat, lng: sos.lng }} 
                      sosId={sos.id} 
                    />
                  </SOSCard>
                  <button
                    onClick={() => handleComplete(sos.id)}
                    className="w-full mt-2 mb-4 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase tracking-widest font-black py-4 rounded-xl transition-all shadow-sm active:scale-95 border border-emerald-500/20"
                  >
                    Mark Mission Complete
                  </button>
                  <div className="mb-8">
                    <LiveChat 
                      sosId={sos.id} 
                      currentUserId={(user?.publicMetadata as any)?.dbId || user?.id || ''} 
                      currentUserName={user?.fullName || 'Volunteer'} 
                      currentUserRole="VOLUNTEER" 
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSOS.length === 0 && myTasks.length === 0 ? (
            <div className="text-center py-24 text-slate-400 flex flex-col items-center">
              <div className="w-16 h-16 border-2 border-dashed border-slate-300 rounded-full mb-6 flex items-center justify-center animate-[spin_10s_linear_infinite]">
                 <div className="w-2 h-2 bg-slate-400 rounded-full" />
              </div>
              <p className="font-black text-slate-600 text-[10px] uppercase tracking-widest">No Active Alerts</p>
              <p className="text-xs mt-2 font-medium">Standby for incoming signals...</p>
            </div>
          ) : (
            <div className="space-y-4">
               {myTasks.length > 0 && (
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3 px-2 flex items-center gap-2 mt-8">
                  <span className="w-full h-px bg-slate-200 flex-1"></span>
                  Open Requests
                  <span className="w-full h-px bg-slate-200 flex-1"></span>
                </p>
              )}
              {activeSOS.map((sos) => (
                <div key={sos.id} className="slide-in">
                  <SOSCard sos={sos} onAccept={handleAccept} isAccepted={false} userLocation={userLoc} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MAP */}
      <div className="hidden md:block flex-1 bg-slate-100 relative">
        <SOSMap 
          sosList={sosList} 
          zoom={9} 
          userLocation={userLoc} 
          routingToId={myTasks[0]?.id || null} 
        />
        {/* Subtle vignette over the map to make it blend with the white theme */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.1)]" />
      </div>
    </div>
  );
}
