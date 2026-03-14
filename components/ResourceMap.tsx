'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import dynamic from 'next/dynamic';
import { useSocket } from '@/hooks/useSocket';

const RESOURCE_TYPES = [
  { type: 'WATER',   label: 'Water',        emoji: '💧', color: 'bg-blue-500',    border: 'border-blue-400',  text: 'text-blue-700',   bg: 'bg-blue-50'   },
  { type: 'FOOD',    label: 'Food',          emoji: '🍞', color: 'bg-yellow-500',  border: 'border-yellow-400',text: 'text-yellow-700', bg: 'bg-yellow-50' },
  { type: 'MEDICAL', label: 'Medical Aid',   emoji: '🏥', color: 'bg-red-500',     border: 'border-red-400',   text: 'text-red-700',    bg: 'bg-red-50'    },
  { type: 'SHELTER', label: 'Shelter',       emoji: '🏠', color: 'bg-emerald-500', border: 'border-emerald-400',text:'text-emerald-700',bg: 'bg-emerald-50'},
  { type: 'POWER',   label: 'Charging',      emoji: '🔋', color: 'bg-purple-500',  border: 'border-purple-400',text: 'text-purple-700', bg: 'bg-purple-50' },
];

interface MapResource {
  id: string; type: string; lat: number; lng: number;
  capacity: number; notes?: string; reporterId: string; createdAt: string;
}

// Save resource to IndexedDB for offline support
async function saveResourceOffline(resource: any) {
  return new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('resqnet_resources', 1);
    req.onupgradeneeded = (e: any) => {
      e.target.result.createObjectStore('resources', { keyPath: 'id' });
    };
    req.onsuccess = (e: any) => {
      const db = e.target.result;
      const tx = db.transaction('resources', 'readwrite');
      tx.objectStore('resources').put({ ...resource, _offline: true });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject();
    };
    req.onerror = () => reject();
  });
}

async function getOfflineResources(): Promise<any[]> {
  return new Promise((resolve) => {
    const req = indexedDB.open('resqnet_resources', 1);
    req.onupgradeneeded = (e: any) => {
      e.target.result.createObjectStore('resources', { keyPath: 'id' });
    };
    req.onsuccess = (e: any) => {
      const db = e.target.result;
      const tx = db.transaction('resources', 'readonly');
      const store = tx.objectStore('resources');
      const getAll = store.getAll();
      getAll.onsuccess = () => resolve(getAll.result || []);
      getAll.onerror = () => resolve([]);
    };
    req.onerror = () => resolve([]);
  });
}

export default function ResourceMap() {
  const { user } = useUser();
  const [resources, setResources] = useState<MapResource[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState('WATER');
  const [capacity, setCapacity] = useState('');
  const [notes, setNotes] = useState('');
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState('ALL');
  const [selectedResource, setSelectedResource] = useState<MapResource | null>(null);
  const [Map, setMap] = useState<any>(null);

  useEffect(() => {
    // Dynamically import Leaflet to prevent SSR issues
    import('leaflet').then(L => {
      setMap(L);
    });
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setGps({ lat: 20.5937, lng: 78.9629 }) // India fallback
      );
    }
  }, []);

  const fetchResources = useCallback(async () => {
    try {
      const res = await fetch('/api/resource-map');
      const data = await res.json();
      if (Array.isArray(data)) {
        setResources(data);
        for (const r of data) await saveResourceOffline(r);
      }
    } catch {
      // Offline fallback
      const offline = await getOfflineResources();
      setResources(offline);
    }
  }, []);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  useSocket({
    resource_added: (res: MapResource) => {
      setResources(prev => prev.some(r => r.id === res.id) ? prev : [res, ...prev]);
    }
  });

  const handleAddResource = async () => {
    if (!gps) return alert('GPS not available');
    if (!selectedType) return alert('Select a resource type');
    setSubmitting(true);
    const userId = (user?.publicMetadata as any)?.dbId || user?.id || 'anonymous';
    try {
      const res = await fetch('/api/resource-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType, lat: gps.lat, lng: gps.lng, capacity: parseInt(capacity) || 0, notes, reporterId: userId }),
      });
      if (res.ok) {
        setShowForm(false);
        setCapacity('');
        setNotes('');
      }
    } catch {
      alert('Offline — resource saved locally');
      await saveResourceOffline({ id: `local_${Date.now()}`, type: selectedType, lat: gps.lat, lng: gps.lng, capacity: parseInt(capacity) || 0, notes, reporterId: userId, createdAt: new Date().toISOString() });
    }
    setSubmitting(false);
  };

  const filtered = filterType === 'ALL' ? resources : resources.filter(r => r.type === filterType);
  const getTypeMeta = (type: string) => RESOURCE_TYPES.find(t => t.type === type) || RESOURCE_TYPES[0];

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b-2 border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="font-black text-slate-900 text-xl tracking-tight">Resource Map</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{filtered.length} Active Supplies</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] px-5 py-3 rounded-xl hover:bg-slate-700 transition-all active:scale-95 shadow-sm"
        >
          + Add Resource
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="px-6 py-3 flex gap-2 overflow-x-auto bg-white border-b border-slate-100">
        <button onClick={() => setFilterType('ALL')} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 whitespace-nowrap transition-all ${filterType === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-500'}`}>All</button>
        {RESOURCE_TYPES.map(t => (
          <button key={t.type} onClick={() => setFilterType(t.type)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 whitespace-nowrap transition-all ${filterType === t.type ? `${t.color} text-white border-transparent` : `bg-white border-slate-200 text-slate-500`}`}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Map Container */}
      <div className="flex-1 relative overflow-hidden">
        <ResourceLeafletMap resources={filtered} gps={gps} onSelect={setSelectedResource} />
      </div>

      {/* Resource List */}
      <div className="bg-white border-t-2 border-slate-200 max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-400 font-bold text-xs uppercase tracking-widest">No resources found. Add one!</div>
        ) : (
          filtered.map(r => {
            const meta = getTypeMeta(r.type);
            return (
              <div key={r.id} onClick={() => setSelectedResource(r)} className={`flex items-center gap-4 px-6 py-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-all ${selectedResource?.id === r.id ? 'bg-blue-50' : ''}`}>
                <span className="text-2xl">{meta.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${meta.bg} ${meta.text} border ${meta.border}`}>{meta.label}</span>
                    {r.capacity > 0 && <span className="text-[9px] text-slate-400 font-bold">Cap: {r.capacity}</span>}
                  </div>
                  {r.notes && <p className="text-slate-600 text-xs font-medium mt-0.5">{r.notes}</p>}
                </div>
                <span className="text-[9px] text-slate-400 font-bold">{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Add Resource Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-end justify-center sm:items-center p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl">
            <h3 className="font-black text-slate-900 text-xl mb-6 uppercase tracking-tighter">Mark Resource Location</h3>
            
            <label className="text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] block mb-3">Resource Type</label>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {RESOURCE_TYPES.map(t => (
                <button key={t.type} onClick={() => setSelectedType(t.type)}
                  className={`py-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all font-black text-[10px] uppercase ${selectedType === t.type ? `${t.color} text-white border-transparent scale-[1.03]` : `bg-white border-slate-200 text-slate-500`}`}>
                  <span className="text-2xl">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>

            <label className="text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] block mb-2">Capacity (people/units)</label>
            <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="e.g. 50" className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 mb-4 text-slate-900 font-bold outline-none focus:border-slate-400" />

            <label className="text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] block mb-2">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="e.g. Potable water, open until 6pm..." className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 mb-4 text-slate-900 font-bold outline-none focus:border-slate-400 resize-none" />

            <div className="bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 mb-6 text-slate-600 text-xs font-bold">
              📍 Using your current GPS location: {gps ? `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : 'Acquiring...'}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">Cancel</button>
              <button onClick={handleAddResource} disabled={submitting || !gps}
                className="flex-1 py-4 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all disabled:opacity-50 active:scale-95">
                {submitting ? 'Saving...' : 'Pin Resource'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import 'leaflet/dist/leaflet.css';

// Leaflet map sub-component
function ResourceLeafletMap({ resources, gps, onSelect }: { resources: MapResource[]; gps: any; onSelect: (r: MapResource) => void }) {
  const mapRef = (useRef as any)(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const container = document.getElementById('resource-map-container');
    if (!container) return;

    // Clean up previous map instance if it exists
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    import('leaflet').then(L => {
      // Critical check: if map was already initialized (race condition), abort
      if (mapRef.current) return;
      
      const container = document.getElementById('resource-map-container');
      if (!container || (container as any)._leaflet_id) return; // Leaflet already attached

      const map = (L as any).map('resource-map-container', { 
        center: gps ? [gps.lat, gps.lng] : [20.5937, 78.9629], 
        zoom: 13, 
        zoomControl: true 
      });
      mapRef.current = map;

      // Fix for map not filling container
      setTimeout(() => { map.invalidateSize(); }, 100);

      (L as any).tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const typeEmojis: Record<string, string> = { WATER: '💧', FOOD: '🍞', MEDICAL: '🏥', SHELTER: '🏠', POWER: '🔋' };
      const typeColors: Record<string, string> = { WATER: '#3b82f6', FOOD: '#eab308', MEDICAL: '#ef4444', SHELTER: '#10b981', POWER: '#8b5cf6' };

      resources.forEach(r => {
        const emoji = typeEmojis[r.type] || '📍';
        const color = typeColors[r.type] || '#64748b';
        const icon = (L as any).divIcon({
          html: `<div style="background:${color};border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:18px;">${emoji}</div>`,
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        const marker = (L as any).marker([r.lat, r.lng], { icon }).addTo(map);
        marker.bindPopup(`<div style="font-family:system-ui;padding:4px"><strong>${emoji} ${r.type}</strong><br/>Capacity: ${r.capacity}<br/>${r.notes || ''}</div>`);
        marker.on('click', () => onSelect(r));
      });

      if (gps) {
        const userIcon = (L as any).divIcon({
          html: `<div style="background:#1e293b;border-radius:50%;width:16px;height:16px;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.5)"></div>`,
          className: '',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        (L as any).marker([gps.lat, gps.lng], { icon: userIcon }).addTo(map).bindPopup('You are here');
      }
    });

    // Resize observer to keep map filling container
    const observer = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [resources, gps]);

  return <div id="resource-map-container" className="w-full h-full min-h-[400px]" />;
}
