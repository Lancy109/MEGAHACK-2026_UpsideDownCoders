'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSocket } from '@/hooks/useSocket';
import { useUser } from '@clerk/nextjs';
import LiveChat from '@/components/LiveChat';

const SOSMap = dynamic(() => import('@/components/SOSMap'), { ssr: false });

// ─── Types ───────────────────────────────────────────────────────────────────
interface SOS {
  id: string; type: string; description: string; status: string;
  lat: number; lng: number; createdAt: string; source: string;
  isVoiceSOS: boolean; aiSuggestion?: string; photoUrl?: string;
  user: { name: string; phone: string };
  tasks: { volunteer: { name: string }; status: string; acceptedAt: string }[];
}
interface Resource { id: string; name: string; category: string; quantity: number; unit: string; location: string; ngoId: string; }
interface Volunteer { id: string; name: string; phone: string; email: string; role: string; }
interface Analytics {
  avgResponseTime: number; todayAlerts: number; active: number;
  resolved: number; resolutionRate: number; alertsPerHour: number[]; total: number;
  hotspots: { lat: number; lng: number; count: number; types: Record<string, number> }[];
}
interface Escalation {
  sosId: string; type: string; victimName: string; victimPhone: string;
  minutesWaiting: number; timestamp: number; handled: boolean;
}

// ─── CountUp component ───────────────────────────────────────────────────────
function CountUp({ target, duration = 800 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.round(p * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return <>{val}</>;
}

// ─── Sparkline chart ─────────────────────────────────────────────────────────
function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const w = 200, h = 40;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Type / Status badges ─────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const cfg: Record<string, string> = {
    MEDICAL: 'bg-red-100 text-red-700 border-red-200',
    FOOD: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    RESCUE: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  return <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${cfg[type] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{type}</span>;
}
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    ACTIVE: 'bg-red-50 text-red-700 border-red-200',
    ASSIGNED: 'bg-amber-50 text-amber-700 border-amber-200',
    RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${cfg[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{status}</span>;
}

// ─── SOS Detail Drawer ────────────────────────────────────────────────────────
function SOSDrawer({ sos, onClose }: { sos: SOS | null; onClose: () => void }) {
  const { user } = useUser();
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const saveNote = async () => {
    if (!sos) return;
    setSavingNote(true);
    await fetch(`/api/sos/${sos.id}/note`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: `[NGO NOTE] ${note}` }),
    });
    setSavingNote(false);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  };

  if (!sos) return null;
  return (
    <div className="fixed inset-y-0 right-0 z-[2000] w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col slide-in">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 flex-shrink-0">
        <button onClick={onClose} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-black text-[10px] uppercase tracking-widest bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-all flex-shrink-0">
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">SOS Detail View</p>
          <p className="font-black text-slate-900 text-sm truncate">{sos.id.slice(-8).toUpperCase()}</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-slate-600 font-black transition-colors flex-shrink-0">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex gap-2 flex-wrap">
          <TypeBadge type={sos.type} />
          <StatusBadge status={sos.status} />
          {sos.source !== 'INTERNET' && <span className="text-[9px] font-black px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200 uppercase tracking-wider">{sos.source}</span>}
        </div>
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Victim</p>
          <p className="font-bold text-slate-900">{sos.user?.name || 'Unknown'}</p>
          <p className="text-xs text-slate-500">{sos.user?.phone}</p>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Description</p>
          <p className="text-sm text-slate-700">{sos.description}</p>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">GPS Coordinates</p>
          <p className="font-mono text-sm text-slate-800">{sos.lat.toFixed(5)}, {sos.lng.toFixed(5)}</p>
          <a href={`https://www.google.com/maps?q=${sos.lat},${sos.lng}`} target="_blank" rel="noreferrer" className="text-blue-600 text-xs font-bold hover:underline">Open in Maps</a>
        </div>
        {sos.aiSuggestion && (
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
            <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">AI Suggestion</p>
            <p className="text-xs text-blue-800 whitespace-pre-line">{sos.aiSuggestion}</p>
          </div>
        )}
        {sos.tasks?.length > 0 && (
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">Volunteer Assigned</p>
            {sos.tasks.map((t: any, i: number) => (
              <div key={i} className="flex justify-between items-center">
                <span className="font-bold text-emerald-800 text-sm">{t.volunteer?.name}</span>
                <StatusBadge status={t.status} />
              </div>
            ))}
          </div>
        )}
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 space-y-2">
          <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Internal NGO Note (Private)</p>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Add internal notes here..." className="w-full text-sm border border-amber-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-amber-400 resize-none" />
          <button onClick={saveNote} disabled={savingNote || !note.trim()} className="text-[10px] font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl disabled:opacity-50 transition-all">
            {noteSaved ? 'SAVED' : savingNote ? 'Saving...' : 'Save Note'}
          </button>
        </div>
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Created: {new Date(sos.createdAt).toLocaleString()}</p>
        
        <div className="pt-6 border-t border-slate-100">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Tactical Comms</p>
          <LiveChat 
            sosId={sos.id} 
            currentUserId={(user?.publicMetadata as any)?.dbId || user?.id || 'ngo_fallback'} 
            currentUserName={user?.fullName || 'NGO Staff'} 
            currentUserRole="NGO" 
          />
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function NGOCommandCenter() {
  const [sosList, setSosList] = useState<SOS[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [selectedSOS, setSelectedSOS] = useState<SOS | null>(null);
  const [activeTab, setActiveTab] = useState('alerts');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showSatellite, setShowSatellite] = useState(false);
  const [escalationBanner, setEscalationBanner] = useState(false);
  const [escalationDismissed, setEscalationDismissed] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Filter states
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState('ALL');
  const [broadcastResult, setBroadcastResult] = useState('');
  const [newResource, setNewResource] = useState({ name: '', category: 'FOOD', quantity: 0, unit: '', location: '', ngoId: 'ngo_1' });
  const [addingResource, setAddingResource] = useState(false);
  const [resourceFilter, setResourceFilter] = useState('ALL');

  // Handle history back to close drawer
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (selectedSOS) {
        setSelectedSOS(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedSOS]);

  const openSOS = (sos: SOS) => {
    setSelectedSOS(sos);
    window.history.pushState({ type: 'sos_detail', id: sos.id }, '');
  };

  const closeSOS = () => {
    if (selectedSOS) {
      setSelectedSOS(null);
      // If we pushed state, maybe we should go back, but for simplicity just clear
    }
  };

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const [sosRes, resRes, volRes, anaRes] = await Promise.all([
      fetch('/api/sos?all=1').then(r => r.json()),
      fetch('/api/resources').then(r => r.json()),
      fetch('/api/users?role=VOLUNTEER').then(r => r.json()),
      fetch('/api/analytics').then(r => r.json()),
    ]);
    if (Array.isArray(sosRes)) setSosList(sosRes);
    if (Array.isArray(resRes)) setResources(resRes);
    if (Array.isArray(volRes)) setVolunteers(volRes);
    if (anaRes && !anaRes.error) setAnalytics(anaRes);
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // ── Escalation banner check ────────────────────────────────────────────────
  useEffect(() => {
    const tenMinsAgo = Date.now() - 10 * 60 * 1000;
    const unattended = sosList.filter(s => s.status === 'ACTIVE' && new Date(s.createdAt).getTime() < tenMinsAgo);
    if (unattended.length > 0 && !escalationDismissed) {
      setEscalationBanner(true);
      if (!audioCtxRef.current) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = 880; gain.gain.value = 0.1;
          osc.start(); setTimeout(() => { osc.stop(); ctx.close(); }, 500);
          audioCtxRef.current = ctx;
        } catch { /* ignore */ }
      }
    } else if (unattended.length === 0) {
      setEscalationBanner(false);
      setEscalationDismissed(false);
      audioCtxRef.current = null;
    }
  }, [sosList, escalationDismissed]);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useSocket({
    sos_received: (newSOS: any) => setSosList(prev => [newSOS, ...prev]),
    task_update: ({ sosId, status }: any) => {
      setSosList(prev => prev.map(s => s.id === sosId ? { ...s, status } : s));
    },
    escalation_alert: (data: any) => {
      setEscalations(prev => [{ ...data, timestamp: Date.now(), handled: false }, ...prev]);
    },
  });


  const sendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    if (broadcastTarget === 'SELECTED_ALERTS' && bulkSelected.size === 0) {
      alert('Please select at least one alert from the table first.');
      return;
    }

    try {
      const res = await fetch('/api/notify/broadcast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: broadcastMsg, 
          target: broadcastTarget,
          alertIds: broadcastTarget === 'SELECTED_ALERTS' ? Array.from(bulkSelected) : []
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send broadcast');
      }
      setBroadcastResult(`Broadcast sent to ${data.sentCount || 0} recipients.`);
      setBroadcastMsg('');
    } catch (err: any) {
      console.error(err);
      setBroadcastResult(`API Error: ${err.message}`);
    }
  };


  const exportCSV = (rows: SOS[]) => {
    const hdr = 'ID,Type,Victim,Description,Status,Lat,Lng,Created\n';
    const rows_ = rows.map(s => `${s.id},${s.type},"${s.user?.name}","${s.description.replace(/"/g, '')}",${s.status},${s.lat},${s.lng},"${s.createdAt}"`).join('\n');
    const blob = new Blob([hdr + rows_], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `sos-export-${Date.now()}.csv`; a.click();
  };

  // ── Sorted/filtered alerts ─────────────────────────────────────────────────
  const filteredSOS = sosList
    .filter(s => filterType === 'ALL' || s.type === filterType)
    .filter(s => filterStatus === 'ALL' || s.status === filterStatus)
    .sort((a, b) => {
      let aVal: any = a[sortKey as keyof SOS] ?? '';
      let bVal: any = b[sortKey as keyof SOS] ?? '';
      if (sortKey === 'createdAt') { aVal = new Date(aVal).getTime(); bVal = new Date(bVal).getTime(); }
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

  const unattendedCount = sosList.filter(s => s.status === 'ACTIVE' && new Date(s.createdAt).getTime() < Date.now() - 10 * 60 * 1000).length;
  const unhandledEscalations = escalations.filter(e => !e.handled).length;

  const sortColumn = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filteredResources = resources.filter(r => resourceFilter === 'ALL' || r.category === resourceFilter);
  const updateResourceQty = async (id: string, qty: number) => {
    await fetch('/api/resources', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, quantity: qty }) });
    setResources(prev => prev.map(r => r.id === id ? { ...r, quantity: qty } : r));
  };
  const addResource = async () => {
    const res = await fetch('/api/resources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newResource) });
    const r = await res.json();
    setResources(prev => [r, ...prev]);
    setAddingResource(false);
    setNewResource({ name: '', category: 'FOOD', quantity: 0, unit: '', location: '', ngoId: 'ngo_1' });
  };

  const assignVolunteer = async (volunteerId: string, sosId: string) => {
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sosId, volunteerId }) });
    fetchAll();
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ESCALATION BANNER */}
      {escalationBanner && !escalationDismissed && (
        <div className="bg-red-600 text-white px-6 py-3 flex items-center justify-between z-50 relative animate-pulse-slow">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 bg-white rounded-full animate-ping" />
            <p className="text-xs font-black uppercase tracking-widest">
              ESCALATION ALERT — {unattendedCount} SOS {unattendedCount === 1 ? 'alert has' : 'alerts have'} been waiting 10+ minutes without a volunteer
            </p>
          </div>
          <button onClick={() => setEscalationDismissed(true)} className="text-xs font-black uppercase tracking-widest bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full transition-all">DISMISS</button>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 font-black text-xl tracking-tighter">ResQNet NGO Command Center</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Strategic Oversight — Live Operations</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-emerald-700 text-[10px] font-black uppercase tracking-widest">Live Feed Active</span>
            </div>
            <button onClick={() => exportCSV(filteredSOS)} className="text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-all">Export CSV</button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

        {/* STATS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          {[
            { label: 'Active', val: analytics?.active ?? 0, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
            { label: 'Assigned', val: sosList.filter(s => s.status === 'ASSIGNED').length, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Resolved', val: analytics?.resolved ?? 0, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
            { label: 'Avg Response', val: analytics?.avgResponseTime ?? 0, unit: 'min', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
            { label: 'Today', val: analytics?.todayAlerts ?? 0, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
            { label: 'Volunteers', val: volunteers.length, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
            { label: 'Resolution %', val: analytics?.resolutionRate ?? 0, unit: '%', color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200' },
          ].map(({ label, val, color, bg, unit }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{label}</p>
              <p className={`font-black text-2xl tracking-tight ${color}`}><CountUp target={val} />{unit || ''}</p>
            </div>
          ))}
        </div>

        {/* MAP + ANALYTICS ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* MAP — 60% */}
          <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden" style={{ height: 480 }}>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Tactical Map — Live Positions</p>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <div onClick={() => setShowHeatmap(h => !h)} className={`w-8 h-4 rounded-full relative transition-all ${showHeatmap ? 'bg-red-500' : 'bg-slate-300'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${showHeatmap ? 'left-4' : 'left-0.5'}`} />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Heatmap</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <div onClick={() => setShowSatellite(s => !s)} className={`w-8 h-4 rounded-full relative transition-all ${showSatellite ? 'bg-slate-700' : 'bg-slate-300'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${showSatellite ? 'left-4' : 'left-0.5'}`} />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Satellite</span>
                </label>
              </div>
            </div>
            <div className="h-[calc(100%-48px)]">
              <SOSMap 
                sosList={sosList} 
                volunteerList={volunteers}
                showHeatmap={showHeatmap} 
                zoom={6} 
                onPinClick={(sos: SOS) => openSOS(sos)} 
                satellite={showSatellite} 
              />
            </div>
          </div>

          {/* ANALYTICS — 40% */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Alerts-per-hour chart */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Alerts Per Hour (Last 24h)</p>
              <Sparkline data={analytics?.alertsPerHour ?? []} />
              <p className="text-[9px] text-slate-400 mt-1">Peak: {Math.max(...(analytics?.alertsPerHour ?? [0]))} alerts/hr</p>
            </div>

            {/* Geographic hotspots */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Geographic Hotspots</p>
              {analytics?.hotspots?.length === 0 && <p className="text-xs text-slate-400">No data yet.</p>}
              <div className="space-y-2">
                {analytics?.hotspots?.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2">
                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-[10px] font-black text-red-600 flex-shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{h.lat.toFixed(2)}, {h.lng.toFixed(2)}</p>
                      <p className="text-[9px] text-slate-400">{Object.entries(h.types).map(([t, c]) => `${t}:${c}`).join(' · ')}</p>
                    </div>
                    <span className="text-xs font-black text-red-600">{h.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Tab headers */}
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {[
              { id: 'alerts', label: 'Alerts Table' },
              { id: 'resources', label: 'Resources' },
              { id: 'volunteers', label: 'Volunteers' },
              { id: 'escalation', label: `Escalation${unhandledEscalations > 0 ? ` (${unhandledEscalations})` : ''}` },
              { id: 'disaster_alert', label: 'Disaster Alert Broadcast' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-slate-900 text-slate-900'
                    : `border-transparent text-slate-400 hover:text-slate-600 ${tab.id === 'escalation' && unhandledEscalations > 0 ? 'text-red-500' : ''}`
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── ALERTS TABLE TAB ── */}
          {activeTab === 'alerts' && (
            <div className="p-5">
              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-4">
                {['ALL', 'MEDICAL', 'FOOD', 'RESCUE'].map(t => (
                  <button key={t} onClick={() => setFilterType(t)}
                    className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${filterType === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t}</button>
                ))}
                <div className="h-5 w-px bg-slate-200 self-center" />
                {['ALL', 'ACTIVE', 'ASSIGNED', 'RESOLVED'].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${filterStatus === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{s}</button>
                ))}
                <div className="ml-auto flex gap-2">
                  {bulkSelected.size > 0 && (
                    <button onClick={() => exportCSV(filteredSOS.filter(s => bulkSelected.has(s.id)))} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all">
                      Export Selected ({bulkSelected.size})
                    </button>
                  )}
                  <button onClick={() => exportCSV(filteredSOS)} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-900 text-white hover:bg-slate-700 transition-all">Export All</button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 w-8"><input type="checkbox" onChange={e => {
                        if (e.target.checked) setBulkSelected(new Set(filteredSOS.map(s => s.id)));
                        else setBulkSelected(new Set());
                      }} /></th>
                      {[
                        { key: 'createdAt', label: 'Time' }, { key: 'type', label: 'Type' },
                        { key: null, label: 'Victim' }, { key: 'description', label: 'Description' },
                        { key: null, label: 'GPS' }, { key: 'status', label: 'Status' },
                        { key: null, label: 'Volunteer' }, { key: null, label: 'Actions' },
                      ].map(col => (
                        <th key={col.label} onClick={() => col.key && sortColumn(col.key)}
                          className={`p-3 text-[9px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap ${col.key ? 'cursor-pointer hover:text-slate-800' : ''}`}>
                          {col.label}{col.key && sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSOS.slice(0, 50).map(sos => (
                      <tr key={sos.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3"><input type="checkbox" checked={bulkSelected.has(sos.id)}
                          onChange={e => {
                            const s = new Set(bulkSelected);
                            if (e.target.checked) s.add(sos.id); else s.delete(sos.id);
                            setBulkSelected(s);
                          }} /></td>
                        <td className="p-3 text-xs text-slate-500 whitespace-nowrap">{new Date(sos.createdAt).toLocaleTimeString()}</td>
                        <td className="p-3"><TypeBadge type={sos.type} /></td>
                        <td className="p-3 text-xs font-bold text-slate-700 max-w-[120px] truncate">{sos.user?.name}</td>
                        <td className="p-3 text-xs text-slate-500 max-w-[180px] truncate">{sos.description}</td>
                        <td className="p-3 text-xs font-mono text-slate-500 whitespace-nowrap">{sos.lat.toFixed(3)}, {sos.lng.toFixed(3)}</td>
                        <td className="p-3"><StatusBadge status={sos.status} /></td>
                        <td className="p-3 text-xs text-slate-500">{sos.tasks?.[0]?.volunteer?.name || '—'}</td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button onClick={() => openSOS(sos)} className="text-[9px] font-black uppercase tracking-widest bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-all">View</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredSOS.length === 0 && <div className="text-center py-10 text-slate-400 text-xs font-bold uppercase tracking-widest">No alerts match filters</div>}
              </div>
            </div>
          )}

          {/* ── RESOURCES TAB ── */}
          {activeTab === 'resources' && (
            <div className="p-5">
              <div className="flex flex-wrap gap-3 mb-4 items-center">
                {['ALL', 'FOOD', 'MEDICAL', 'Equipment', 'Personnel'].map(c => (
                  <button key={c} onClick={() => setResourceFilter(c)}
                    className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${resourceFilter === c ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{c}</button>
                ))}
                <button onClick={() => setAddingResource(a => !a)} className="ml-auto text-[9px] font-black uppercase tracking-widest bg-blue-600 text-white px-4 py-1.5 rounded-full hover:bg-blue-700 transition-all">+ Add Resource</button>
              </div>

              {addingResource && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: 'name', placeholder: 'Resource Name', label: 'Name' },
                    { key: 'unit', placeholder: 'kg / units / liters', label: 'Unit' },
                    { key: 'location', placeholder: 'Depot / Camp Name', label: 'Location' },
                  ].map(f => (
                    <div key={f.key}>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{f.label}</p>
                      <input value={(newResource as any)[f.key]} onChange={e => setNewResource(r => ({ ...r, [f.key]: e.target.value }))}
                        placeholder={f.placeholder} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400" />
                    </div>
                  ))}
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Category</p>
                    <select value={newResource.category} onChange={e => setNewResource(r => ({ ...r, category: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 bg-white">
                      {['FOOD', 'MEDICAL', 'Equipment', 'Personnel'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Quantity</p>
                    <input type="number" value={newResource.quantity} onChange={e => setNewResource(r => ({ ...r, quantity: parseInt(e.target.value) || 0 }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400" />
                  </div>
                  <div className="flex items-end">
                    <button onClick={addResource} className="w-full text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 transition-all">Add</button>
                  </div>
                </div>
              )}

              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    {['Name', 'Category', 'Quantity', 'Unit', 'Location', 'Stock Alert', 'Edit'].map(h => (
                      <th key={h} className="p-3 text-[9px] font-black uppercase tracking-widest text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResources.map(r => (
                    <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${r.quantity < 10 ? 'bg-red-50/50' : ''}`}>
                      <td className="p-3 text-xs font-bold text-slate-800">{r.name}</td>
                      <td className="p-3 text-xs text-slate-500">{r.category}</td>
                      <td className="p-3 text-xs font-black text-slate-800">{r.quantity}</td>
                      <td className="p-3 text-xs text-slate-500">{r.unit}</td>
                      <td className="p-3 text-xs text-slate-500">{r.location}</td>
                      <td className="p-3">{r.quantity < 10 && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">Low Stock</span>}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateResourceQty(r.id, Math.max(0, r.quantity - 1))} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-black text-slate-700 flex items-center justify-center text-xs transition-all">−</button>
                          <button onClick={() => updateResourceQty(r.id, r.quantity + 1)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-black text-slate-700 flex items-center justify-center text-xs transition-all">+</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredResources.length === 0 && <div className="text-center py-10 text-slate-400 text-xs font-bold uppercase tracking-widest">No resources found</div>}
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total items: {filteredResources.length}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-red-500">{filteredResources.filter(r => r.quantity < 10).length} low stock items</p>
              </div>
            </div>
          )}

          {/* ── VOLUNTEER MANAGEMENT TAB ── */}
          {activeTab === 'volunteers' && (
            <div className="p-5">
              <div className="mb-4 flex justify-between items-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{volunteers.length} Registered Volunteers</p>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    {['Name', 'Phone', 'Email', 'Current Task', 'Actions'].map(h => (
                      <th key={h} className="p-3 text-[9px] font-black uppercase tracking-widest text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {volunteers.map(v => {
                    const task = sosList.find(s => s.tasks?.some(t => t.volunteer?.name === v.name && s.status === 'ASSIGNED'));
                    return (
                      <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-xs font-bold text-slate-800">{v.name}</td>
                        <td className="p-3 text-xs text-slate-500">{v.phone}</td>
                        <td className="p-3 text-xs text-slate-500 max-w-[150px] truncate">{v.email}</td>
                        <td className="p-3 text-xs">{task ? <StatusBadge status="ASSIGNED" /> : <span className="text-slate-400 text-[9px] font-black uppercase">Available</span>}</td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            {!task && (
                              <select onChange={e => { if (e.target.value) assignVolunteer(v.id, e.target.value); e.target.value = ''; }}
                                className="text-[9px] font-black uppercase tracking-widest bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1.5 rounded-lg cursor-pointer outline-none">
                                <option value="">Assign to SOS...</option>
                                {sosList.filter(s => s.status === 'ACTIVE').map(s => (
                                  <option key={s.id} value={s.id}>{s.type} — {s.user?.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {volunteers.length === 0 && <div className="text-center py-10 text-slate-400 text-xs font-bold uppercase tracking-widest">No volunteers registered</div>}
            </div>
          )}

          {/* ── ESCALATION LOG TAB ── */}
          {activeTab === 'escalation' && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{escalations.length} Escalation Events This Session</p>
                <button onClick={() => setEscalations(prev => prev.filter(e => !e.handled))} className="text-[9px] font-black uppercase tracking-widest bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full transition-all">Clear Handled</button>
              </div>
              {escalations.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                      <div className="w-4 h-2 border-b-2 border-l-2 border-white -rotate-45 -mt-0.5" />
                    </div>
                  </div>
                  <p className="text-sm font-black text-slate-700 uppercase tracking-tighter">No escalations this session</p>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">All alerts responded to on time</p>
                </div>
              )}
              <div className="space-y-3">
                {escalations.map((e, i) => (
                  <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${e.handled ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">SOS ID</p><p className="text-xs font-bold text-slate-800">{e.sosId?.slice(-8).toUpperCase()}</p></div>
                      <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</p><TypeBadge type={e.type} /></div>
                      <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Victim</p><p className="text-xs font-bold text-slate-800">{e.victimName}</p></div>
                      <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Waiting</p><p className="text-xs font-black text-red-600">{e.minutesWaiting}+ min</p></div>
                    </div>
                    <div className="flex gap-2">
                      {!e.handled && (
                        <button onClick={() => setEscalations(prev => prev.map((ev, j) => j === i ? { ...ev, handled: true } : ev))}
                          className="text-[9px] font-black uppercase tracking-widest bg-emerald-100 border border-emerald-300 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200 transition-all">
                          Mark Handled
                        </button>
                      )}
                      {e.handled && <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Resolved</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DISASTER ALERT BROADCAST TAB ── */}
          {activeTab === 'disaster_alert' && (
            <div className="p-5 grid grid-cols-1 gap-6">
              <div className="bg-red-50/50 border border-red-200 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-red-100">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582c.586.235.953.79.953 1.415V15a1 1 0 01-1 1H5a1 1 0 01-1-1V7.32c0-.625.367-1.18.953-1.415L9 4.323V3a1 1 0 011-1zm-6 8h12v4H4v-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase text-red-700 tracking-widest">Disaster Alert Broadcast System</h2>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">URGENT PUSH NOTIFICATION NETWORK</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="bg-white/50 border border-red-100 rounded-xl p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Target Audience</p>
                      <p className="text-sm font-black text-red-600">All Registered Users (Global Broadcast)</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Alert Message</p>
                      <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} rows={5}
                        placeholder="Enter the critical alert details. This will be broadcasted to the notification panels of all registered users immediately." 
                        className="w-full text-sm font-medium border-2 border-slate-200 rounded-2xl px-4 py-3 bg-white outline-none focus:border-red-400 focus:bg-red-50/10 resize-none transition-colors" />
                    </div>
                    <button 
                      onClick={sendBroadcast} 
                      disabled={!broadcastMsg.trim()} 
                      className="w-full text-xs font-black uppercase tracking-widest bg-red-600 text-white py-4 rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600 transition-all shadow-[0_4px_12px_rgba(220,38,38,0.3)] hover:shadow-[0_6px_16px_rgba(220,38,38,0.5)] active:scale-[0.98]"
                    >
                      Post Alert
                    </button>
                    {broadcastResult && (
                      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl animate-fade-in">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold shrink-0">✓</div>
                        <p className="text-xs font-bold text-emerald-700">{broadcastResult}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="hidden md:flex flex-col justify-center bg-white rounded-2xl p-6 border border-slate-200">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-100 pb-2">Broadcast Protocol</p>
                    <ul className="space-y-4 text-xs font-medium text-slate-600">
                      <li className="flex gap-3">
                        <span className="text-blue-500 font-black">1.</span>
                        Draft a clear, concise alert message. All registered users will receive this instantly.
                      </li>
                      <li className="flex gap-3">
                        <span className="text-blue-500 font-black">2.</span>
                        Click <b>Post Alert</b> to initiate the global transmission.
                      </li>
                      <li className="flex gap-3">
                        <span className="text-blue-500 font-black">3.</span>
                        Verify delivery in your own Notification Panel (Bell icon).
                      </li>
                      <li className="flex gap-3 mt-4 text-red-600 font-bold bg-red-50 p-3 rounded-xl">
                        🚨 Warning: Global broadcasts trigger urgent signals to all active devices and cannot be retracted.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SOS DETAIL DRAWER */}
      {selectedSOS && <SOSDrawer sos={selectedSOS} onClose={closeSOS} />}
    </div>
  );
}
