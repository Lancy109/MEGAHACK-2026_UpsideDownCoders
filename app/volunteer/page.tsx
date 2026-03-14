'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useSocket } from '@/hooks/useSocket';
import SOSCard from '@/components/SOSCard';
import SOSMap from '@/components/SOSMap';
import LiveChat from '@/components/LiveChat';
import ETACard from '@/components/ETACard';

function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function VolunteerPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && user) {
      if (!user.publicMetadata?.role) {
        router.replace('/user-type');
      }
    }
  }, [isLoaded, user, router]);
  
  const [sosList, setSosList]         = useState<any[]>([]);
  const [acceptedMap, setAcceptedMap] = useState<Record<string, boolean>>({});
  const [taskMap, setTaskMap]         = useState<Record<string, string>>({});
  const [userLoc, setUserLoc]         = useState<{ lat: number; lng: number } | null>(null);

  // Advanced feature states
  const [filterType, setFilterType]   = useState<string>('ALL');
  const [filterRadius, setFilterRadius] = useState<number>(Infinity);
  const [battery, setBattery]         = useState<number | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [showMap, setShowMap]         = useState(true);

  // Unread badge tracking
  const [unreadCount, setUnreadCount] = useState(0);
  const [broadcast, setBroadcast] = useState<{message: string, timestamp: number} | null>(null);
  const [escalations, setEscalations] = useState<any[]>([]);

  useEffect(() => {
    // @ts-ignore
    if (typeof navigator !== 'undefined' && navigator.getBattery) {
      // @ts-ignore
      navigator.getBattery().then(bat => {
        setBattery(bat.level * 100);
        bat.addEventListener('levelchange', () => setBattery(bat.level * 100));
      });
    }
  }, []);

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
      const resSOS = await fetch('/api/sos');
      const dataSOS = await resSOS.json();
      if (Array.isArray(dataSOS)) setSosList(dataSOS);

      const dbId = (user?.publicMetadata as any)?.dbId;
      const uid = dbId || user?.id;
      
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
        
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
          gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.2);
        } catch(e) {}

        setUnreadCount(c => c + 1);
        return [newSOS, ...prev];
      });
    },
    task_update: ({ sosId, status }: { sosId: string, status: string }) => {
      setSosList((prev) => prev.map((s) => s.id === sosId ? { ...s, status } : s));
    },
    sos_resolved: ({ sosId }: { sosId: string }) => {
      setSosList((prev) => prev.filter((s) => s.id !== sosId));
    },
    broadcast_receive: (data: any) => {
      // Handled globally in GlobalToasts
    },
    escalation_alert: (data: any) => {
      // Handled globally in GlobalToasts
    }
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
    setCompletedCount(prev => prev + 1);
    setSosList((prev) => prev.filter((s) => s.id !== sosId));
    setAcceptedMap((prev) => { const n = { ...prev }; delete n[sosId]; return n; });
  }

  let activeSOS = sosList.filter((s) => s.status !== 'RESOLVED' && !acceptedMap[s.id]);

  if (filterType !== 'ALL') {
    activeSOS = activeSOS.filter((s) => s.type === filterType);
  }

  if (filterRadius !== Infinity && userLoc) {
    activeSOS = activeSOS.filter((s) => getDistanceInKm(userLoc.lat, userLoc.lng, s.lat, s.lng) <= filterRadius);
  }

  activeSOS.sort((a, b) => {
    const getUrgency = (sos: any) => {
      if (sos.aiSuggestion?.includes('CRITICAL')) return 3;
      if (sos.aiSuggestion?.includes('MEDIUM')) return 2;
      return 1;
    };
    return getUrgency(b) - getUrgency(a);
  });

  const myTasks = sosList.filter((s) => acceptedMap[s.id]);

  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) New SOS - ResQNet`;
    } else {
      document.title = `ResQNet Mission Control`;
    }
  }, [unreadCount]);

  useEffect(() => {
    const handleInteraction = () => setUnreadCount(0);
    window.addEventListener('click', handleInteraction);
    return () => window.removeEventListener('click', handleInteraction);
  }, []);

  return (
    <div className="h-[calc(100vh-[var(--navbar-height,4rem)])] bg-slate-50 flex overflow-hidden font-sans relative">
      <div className={`w-full flex-shrink-0 flex flex-col border-r-2 border-slate-200 bg-slate-50 overflow-hidden z-10 transition-all duration-500 ${showMap ? 'md:w-[500px]' : 'md:w-full'}`}>
        <div className="px-8 py-6 border-b-2 border-slate-200 bg-white flex items-center justify-between z-20 shadow-sm relative">
          <h2 className="text-slate-900 font-black text-2xl tracking-tight">Mission Control</h2>
          <span className="bg-red-50 border border-red-200 text-red-700 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl flex items-center gap-3">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
            {activeSOS.length} Live Alerts
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 pb-24 bg-slate-50 custom-scrollbar">
          <div className="mb-8 grid grid-cols-2 gap-3">
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Impact Score</span>
              <span className="text-2xl font-black text-slate-900">{98 + completedCount * 2}<span className="text-sm text-slate-400 ml-1">%</span></span>
              <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 mt-1 rounded-md border border-emerald-100 uppercase tracking-widest">Top 5% Vanguard</span>
            </div>
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Missions Done</span>
              <span className="text-2xl font-black text-slate-900">{12 + completedCount}</span>
              <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 mt-1 rounded-md border border-blue-100 uppercase tracking-widest">Active Session</span>
            </div>
          </div>

          {battery !== null && battery < 20 && (
            <div className="mb-8 bg-red-50 border-2 border-red-200 rounded-2xl p-4 shadow-sm flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0 border border-red-200">
                <span className="w-1 h-4 bg-red-500 rounded-full animate-pulse shadow-sm" />
              </div>
              <div>
                <h4 className="text-red-800 font-black text-xs uppercase tracking-widest">Low Hardware Power</h4>
                <p className="text-red-700 text-[10px] font-bold mt-1 leading-relaxed">Device battery at {Math.round(battery)}%. Proceed to extraction or connect to power immediately to prevent comms blackout.</p>
              </div>
            </div>
          )}

          {myTasks.length === 0 && (
            <div className="mb-8 space-y-3">
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
                {['ALL', 'MEDICAL', 'FOOD', 'RESCUE'].map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-4 py-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${
                      filterType === type 
                        ? 'bg-slate-900 border-slate-900 text-white' 
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
                {[Infinity, 25, 10, 5].map(rad => (
                  <button
                    key={rad}
                    onClick={() => setFilterRadius(rad)}
                    className={`px-4 py-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${
                      filterRadius === rad 
                        ? 'bg-slate-900 border-slate-900 text-white' 
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {rad === Infinity ? 'GLOBAL RAD' : `< ${rad} KM`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {myTasks.length > 0 && (
            <div className="mb-10">
              <p className="text-emerald-700 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Active Deployment
                <span className="h-px bg-slate-200 flex-1 ml-2"></span>
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
                    className="w-full mb-6 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] uppercase tracking-[0.2em] font-black py-4 rounded-xl transition-all shadow-sm active:scale-95 border-2 border-emerald-200"
                  >
                    MARK MISSION COMPLETE
                  </button>
                  <div className="mb-8">
                    <LiveChat 
                      sosId={sos.id} 
                      currentUserId={(user?.publicMetadata as any)?.dbId || user?.id || 'volunteer_fallback'} 
                      currentUserName={user?.fullName || 'Volunteer'} 
                      currentUserRole="VOLUNTEER" 
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSOS.length === 0 && myTasks.length === 0 ? (
            <div className="text-center py-32 flex flex-col items-center">
              <div className="w-20 h-20 border-4 border-dashed border-slate-200 rounded-full mb-8 flex items-center justify-center animate-[spin_10s_linear_infinite]">
                 <div className="w-3 h-3 bg-slate-300 rounded-full" />
              </div>
              <p className="font-black text-slate-400 text-xs uppercase tracking-[0.2em]">No Active Alerts</p>
              <p className="text-slate-500 text-sm mt-3 font-bold">Standby for incoming signals...</p>
            </div>
          ) : (
            <div className="space-y-6">
               {myTasks.length > 0 && (
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-3 mt-10">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  Open Requests
                  <span className="h-px bg-slate-200 flex-1 ml-2"></span>
                </p>
              )}
              {activeSOS.map((sos) => (
                <div key={sos.id} className="slide-in relative">
                  {(Date.now() - new Date(sos.createdAt).getTime() < 60000) && (
                    <span className="absolute -top-3 -right-3 z-10 bg-red-600 text-white text-[9px] font-black tracking-widest px-2 py-1 rounded-full shadow-lg border-2 border-white animate-bounce">
                      NEW ALERT
                    </span>
                  )}
                  <SOSCard sos={sos} onAccept={handleAccept} isAccepted={false} userLocation={userLoc} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showMap && (
        <div className="hidden md:block flex-1 bg-white relative slide-in">
          <SOSMap 
            sosList={sosList} 
            zoom={9} 
            userLocation={userLoc} 
            routingToId={myTasks[0]?.id || null} 
          />
          <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(255,255,255,0.8)]" />
        </div>
      )}

      {/* BROADCAST NOTIFICATION REMOVED - NOW GLOBAL */}

      <button 
        onClick={() => setShowMap(!showMap)}
        className="hidden md:flex fixed bottom-6 right-6 z-50 bg-slate-900 text-white shadow-xl hover:bg-slate-800 border-2 border-slate-700 px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 items-center gap-2"
      >
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        {showMap ? 'HIDE TACTICAL MAP' : 'SHOW TACTICAL MAP'}
      </button>
    </div>
  );
}
