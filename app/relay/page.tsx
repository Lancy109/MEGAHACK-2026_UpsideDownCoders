'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SOSPacket {
  id: string; type: string; lat: number; lng: number;
  timestamp: number; ttl: number; description?: string;
  relayCount: number; source: 'DIRECT' | 'BLE' | 'QR' | 'WEBRTC';
  uploaded?: boolean;
}

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
const DB_NAME = 'resqnet_relay';
const DB_STORE = 'sos_relay';

function openRelayDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function savePacket(packet: SOSPacket): Promise<void> {
  const db = await openRelayDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(packet);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function getAllPackets(): Promise<SOSPacket[]> {
  const db = await openRelayDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}

async function markUploaded(id: string): Promise<void> {
  const db = await openRelayDB();
  const tx = db.transaction(DB_STORE, 'readwrite');
  const store = tx.objectStore(DB_STORE);
  const req = store.get(id);
  req.onsuccess = () => {
    if (req.result) store.put({ ...req.result, uploaded: true });
  };
}

async function clearStore(): Promise<void> {
  const db = await openRelayDB();
  const tx = db.transaction(DB_STORE, 'readwrite');
  tx.objectStore(DB_STORE).clear();
}

// ─── Deduplication set (in-memory + refreshed from DB) ───────────────────────
const seenPackets = new Set<string>();

async function ingestPacket(packet: SOSPacket, source: SOSPacket['source']): Promise<boolean> {
  if (seenPackets.has(packet.id)) return false; // already seen
  if (packet.ttl <= 0) return false; // TTL expired
  seenPackets.add(packet.id);
  const toSave: SOSPacket = { ...packet, ttl: packet.ttl - 1, relayCount: (packet.relayCount || 0) + 1, source, uploaded: false };
  await savePacket(toSave);
  return true;
}

// ─── QR Code generator (simple canvas approach) ───────────────────────────────
function buildQRString(p: SOSPacket) {
  return `SOS|${p.type}|${p.lat}|${p.lng}|${p.timestamp}|${p.id}|${p.ttl}|${p.description || ''}`;
}

function parseQRString(str: string): SOSPacket | null {
  try {
    const [, type, lat, lng, timestamp, id, ttl, desc] = str.split('|');
    if (!id || !type) return null;
    return { id, type, lat: parseFloat(lat), lng: parseFloat(lng), timestamp: parseInt(timestamp), ttl: Math.max(0, parseInt(ttl) - 1), description: desc, relayCount: 1, source: 'QR' };
  } catch { return null; }
}

// ─── Status badge ──────────────────────────────────────────────────────────────
function SourceBadge({ source }: { source: string }) {
  const cfg: Record<string, string> = {
    DIRECT: 'bg-blue-100 text-blue-700 border-blue-200',
    BLE: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    QR: 'bg-amber-100 text-amber-700 border-amber-200',
    WEBRTC: 'bg-purple-100 text-purple-700 border-purple-200',
  };
  return <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${cfg[source] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{source}</span>;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function OfflineRelay() {
  const [packets, setPackets] = useState<SOSPacket[]>([]);
  const [activeTab, setActiveTab] = useState<'store' | 'bluetooth' | 'qr' | 'webrtc' | 'sync'>('store');
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState('');

  // Create SOS form
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState('MEDICAL');
  const [newDesc, setNewDesc] = useState('');
  const [newTTL, setNewTTL] = useState(5);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // BLE state
  const [bleStatus, setBleStatus] = useState<'idle' | 'scanning' | 'connected' | 'error'>('idle');
  const [bleLog, setBleLog] = useState<string[]>([]);

  // QR state
  const [qrPacket, setQrPacket] = useState<SOSPacket | null>(null);
  const [qrScanInput, setQrScanInput] = useState('');
  const [qrImportResult, setQrImportResult] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // WebRTC state
  const [rtcStatus, setRtcStatus] = useState<'idle' | 'offering' | 'connected' | 'error'>('idle');
  const [rtcOffer, setRtcOffer] = useState('');
  const [rtcAnswer, setRtcAnswer] = useState('');
  const [rtcLog, setRtcLog] = useState<string[]>([]);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  // ── Load packets from IndexedDB ───────────────────────────────────────────
  const refreshPackets = useCallback(async () => {
    const all = await getAllPackets();
    setPackets(all.sort((a, b) => b.timestamp - a.timestamp));
    all.forEach(p => seenPackets.add(p.id));
  }, []);

  useEffect(() => {
    refreshPackets();
    setIsOnline(navigator.onLine);
    const onOnline = () => { setIsOnline(true); autoSync(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [refreshPackets]);

  // ── GPS ───────────────────────────────────────────────────────────────────
  const getLocation = () => {
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocation({ lat: 19.076, lng: 72.877 }) // Mumbai fallback
    );
  };

  // ── Create SOS packet ─────────────────────────────────────────────────────
  const createSOS = async () => {
    if (!location) { getLocation(); return; }
    const packet: SOSPacket = {
      id: crypto.randomUUID(),
      type: newType, description: newDesc,
      lat: location.lat, lng: location.lng,
      timestamp: Date.now(), ttl: newTTL,
      relayCount: 0, source: 'DIRECT', uploaded: false,
    };
    seenPackets.add(packet.id);
    await savePacket(packet);
    setCreating(false);
    setNewDesc('');
    await refreshPackets();
  };

  // ── Auto-sync when online ─────────────────────────────────────────────────
  const autoSync = useCallback(async () => {
    const all = await getAllPackets();
    const pending = all.filter(p => !p.uploaded);
    if (pending.length === 0) return;
    setSyncing(true);
    let uploaded = 0;
    for (const p of pending) {
      try {
        const res = await fetch('/api/sos/relay', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p),
        });
        if (res.ok) { await markUploaded(p.id); uploaded++; }
      } catch { /* stay offline */ }
    }
    setSyncing(false);
    if (uploaded > 0) { setSyncResult(`Uploaded ${uploaded} packet(s) to server.`); await refreshPackets(); }
  }, [refreshPackets]);

  const manualSync = async () => {
    setSyncResult('');
    await autoSync();
    if (!syncing) setSyncResult(packets.filter(p => !p.uploaded).length === 0 ? 'All packets already synced.' : 'Sync attempted.');
  };

  // ── BLE Send ──────────────────────────────────────────────────────────────
  const bleLog_ = (...msgs: string[]) => setBleLog(prev => [...prev.slice(-9), ...msgs]);

  const bleSend = async (packet: SOSPacket) => {
    const nav = navigator as any;
    if (!nav.bluetooth) { setBleStatus('error'); bleLog_('Web Bluetooth not supported in this browser.'); return; }
    try {
      setBleStatus('scanning');
      bleLog_('Requesting nearby BLE device...');
      const device = await nav.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['battery_service'] });
      bleLog_(`Connected to: ${device.name || 'Unknown Device'}`);
      const server = await device.gatt.connect();
      bleLog_('GATT server connected. Locating battery_service...');
      const service = await server.getPrimaryService('battery_service');
      const char = await service.getCharacteristic('battery_level');
      const qrStr = buildQRString(packet);
      await char.writeValue(new TextEncoder().encode(qrStr.slice(0, 512)));
      bleLog_(`SOS packet sent (${qrStr.length} bytes). TTL: ${packet.ttl}`);
      setBleStatus('connected');
    } catch (e: any) {
      bleLog_(`BLE Error: ${e.message || 'Unknown error'}`);
      setBleStatus('error');
    }
  };

  const bleScan = async () => {
    const nav = navigator as any;
    if (!nav.bluetooth) { bleLog_('Web Bluetooth not supported.'); return; }
    try {
      setBleStatus('scanning');
      bleLog_('Requesting BLE device to read from...');
      const device = await nav.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['battery_service'] });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('battery_service');
      const char = await service.getCharacteristic('battery_level');
      const val = await char.readValue();
      const text = new TextDecoder().decode(val);
      bleLog_(`Received raw: ${text.slice(0, 80)}...`);
      const parsed = parseQRString(text);
      if (parsed) {
        const isNew = await ingestPacket(parsed, 'BLE');
        if (isNew) { bleLog_(`Imported NEW packet: ${parsed.id.slice(-8)} (${parsed.type})`); await refreshPackets(); }
        else bleLog_('Packet already seen — skipped (deduplication).');
      } else bleLog_('Could not parse received data as SOS packet.');
      setBleStatus('idle');
    } catch (e: any) {
      bleLog_(`BLE Scan Error: ${e.message}`);
      setBleStatus('error');
    }
  };

  // ── QR Draw (simple text-based visualization on canvas) ───────────────────
  useEffect(() => {
    if (!qrPacket || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const qrStr = buildQRString(qrPacket);
    canvas.width = 320; canvas.height = 320;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 320, 320);
    // Simple visual: encode as dots pattern for hackathon demo
    ctx.fillStyle = '#0f172a';
    const chars = qrStr.split('');
    const size = Math.floor(320 / Math.ceil(Math.sqrt(chars.length * 8)));
    chars.forEach((c, i) => {
      const bits = c.charCodeAt(0).toString(2).padStart(8, '0');
      bits.split('').forEach((b, j) => {
        if (b === '1') {
          const idx = i * 8 + j;
          const col = idx % Math.floor(320 / size);
          const row = Math.floor(idx / Math.floor(320 / size));
          ctx.fillRect(col * size, row * size, size - 1, size - 1);
        }
      });
    });
    // Border
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 316, 316);
    // Label
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`SOS·${qrPacket.type}·TTL:${qrPacket.ttl}`, 10, 314);
  }, [qrPacket]);

  const importQR = async () => {
    if (!qrScanInput.trim()) return;
    const parsed = parseQRString(qrScanInput.trim());
    if (!parsed) { setQrImportResult('Invalid QR/SOS data format.'); return; }
    const isNew = await ingestPacket(parsed, 'QR');
    if (isNew) { setQrImportResult(`Imported packet ${parsed.id.slice(-8)} (${parsed.type}, TTL: ${parsed.ttl}).`); await refreshPackets(); }
    else setQrImportResult('Already have this packet — skipped.');
    setQrScanInput('');
  };

  // ── WebRTC P2P ────────────────────────────────────────────────────────────
  const rtcLog_ = (...msgs: string[]) => setRtcLog(prev => [...prev.slice(-9), ...msgs]);

  const initWebRTC = () => {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    pc.onicecandidate = e => { if (!e.candidate) rtcLog_('ICE gathering complete.'); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { setRtcStatus('connected'); rtcLog_('Peer connected!'); }
      if (pc.connectionState === 'disconnected') { setRtcStatus('idle'); rtcLog_('Peer disconnected.'); }
    };
    return pc;
  };

  const createOffer = async () => {
    const pc = initWebRTC();
    const dc = pc.createDataChannel('sos_relay');
    dcRef.current = dc;
    dc.onopen = () => { rtcLog_('DataChannel opened — sending packets...'); sendPacketsViaRTC(); };
    dc.onmessage = async e => {
      try {
        const incoming: SOSPacket[] = JSON.parse(e.data);
        let imported = 0;
        for (const p of incoming) { if (await ingestPacket(p, 'WEBRTC')) imported++; }
        rtcLog_(`Received ${incoming.length} packets, imported ${imported} new.`);
        await refreshPackets();
      } catch { rtcLog_('Failed to parse incoming data.'); }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await new Promise(res => setTimeout(res, 1000));
    setRtcOffer(JSON.stringify(pc.localDescription));
    setRtcStatus('offering');
    rtcLog_('Offer created. Share it with the other device.');
  };

  const acceptOffer = async () => {
    if (!rtcOffer.trim()) return;
    const pc = initWebRTC();
    pc.ondatachannel = e => {
      dcRef.current = e.channel;
      e.channel.onopen = () => { rtcLog_('DataChannel opened — sending packets...'); sendPacketsViaRTC(); };
      e.channel.onmessage = async ev => {
        try {
          const incoming: SOSPacket[] = JSON.parse(ev.data);
          let imported = 0;
          for (const p of incoming) { if (await ingestPacket(p, 'WEBRTC')) imported++; }
          rtcLog_(`Received ${incoming.length} packets, imported ${imported} new.`);
          await refreshPackets();
        } catch { rtcLog_('Failed to parse incoming data.'); }
      };
    };
    await pc.setRemoteDescription(JSON.parse(rtcOffer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await new Promise(res => setTimeout(res, 1000));
    setRtcAnswer(JSON.stringify(pc.localDescription));
    rtcLog_('Answer created. Share it back to the offerer.');
  };

  const setAnswer = async () => {
    if (!rtcAnswer.trim() || !pcRef.current) return;
    await pcRef.current.setRemoteDescription(JSON.parse(rtcAnswer));
    rtcLog_('Remote answer set. Waiting for connection...');
  };

  const sendPacketsViaRTC = async () => {
    const all = await getAllPackets();
    const toSend = all.filter(p => p.ttl > 0);
    dcRef.current?.send(JSON.stringify(toSend));
    rtcLog_(`Sent ${toSend.length} packet(s) to peer.`);
  };

  const pendingCount = packets.filter(p => !p.uploaded).length;
  const uploadedCount = packets.filter(p => p.uploaded).length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 font-black text-xl tracking-tighter">Offline SOS Relay Node</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Store → Exchange → Relay — Delay-Tolerant Network</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${isOnline ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700 animate-pulse'}`}>
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'} ${isOnline ? '' : 'animate-ping'}`} />
              {isOnline ? 'Online' : 'Offline Mode'}
            </div>
            <button onClick={manualSync} disabled={syncing || !isOnline} className="text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 disabled:opacity-40 transition-all">
              {syncing ? 'Syncing...' : `Sync (${pendingCount})`}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Sync result */}
        {syncResult && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 text-xs font-bold text-emerald-700 flex justify-between items-center">
            {syncResult}
            <button onClick={() => setSyncResult('')} className="text-emerald-500 hover:text-emerald-700 font-black">✕</button>
          </div>
        )}

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Stored Packets', val: packets.length, color: 'text-slate-900', bg: 'bg-white border-slate-200' },
            { label: 'Pending Upload', val: pendingCount, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
            { label: 'Synced', val: uploadedCount, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
            { label: 'Seen IDs', val: seenPackets.size, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{s.label}</p>
              <p className={`font-black text-2xl tracking-tight ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {[
              { id: 'store', label: 'Packet Store' },
              { id: 'bluetooth', label: 'Bluetooth Relay' },
              { id: 'qr', label: 'QR Transfer' },
              { id: 'webrtc', label: 'WebRTC P2P' },
              { id: 'sync', label: 'Internet Sync' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${activeTab === tab.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── PACKET STORE TAB ── */}
          {activeTab === 'store' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Local Relay Store (IndexedDB)</p>
                <div className="flex gap-2">
                  <button onClick={() => { getLocation(); setCreating(c => !c); }} className="text-[9px] font-black uppercase tracking-widest bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition-all">
                    + New SOS Packet
                  </button>
                  <button onClick={async () => { await clearStore(); seenPackets.clear(); await refreshPackets(); }} className="text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-700 px-3 py-2 rounded-xl hover:bg-slate-200 transition-all">
                    Clear All
                  </button>
                </div>
              </div>

              {/* Create form */}
              {creating && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Emergency Type</p>
                    <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none">
                      {['MEDICAL', 'RESCUE', 'FOOD', 'FIRE', 'FLOOD'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">TTL (Hop Limit)</p>
                    <input type="number" value={newTTL} onChange={e => setNewTTL(parseInt(e.target.value) || 5)} min={1} max={10} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">GPS</p>
                    <p className="text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-2 bg-white">
                      {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Getting location...'}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Description</p>
                    <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Describe the emergency..." className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-red-400" />
                  </div>
                  <div className="flex items-end">
                    <button onClick={createSOS} disabled={!location} className="w-full text-[10px] font-black uppercase tracking-widest bg-red-600 text-white py-2 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all">
                      Broadcast SOS
                    </button>
                  </div>
                </div>
              )}

              {/* Packet list */}
              {packets.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm font-black text-slate-700 uppercase tracking-tighter">No packets stored</p>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Create an SOS or receive one via BLE / QR</p>
                </div>
              )}
              <div className="space-y-2">
                {packets.map(p => (
                  <div key={p.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${p.uploaded ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-slate-200 hover:border-blue-200'}`}>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-black text-slate-600">{p.type.slice(0, 3)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-black text-slate-800">{p.id.slice(-8).toUpperCase()}</span>
                        <SourceBadge source={p.source} />
                        {p.uploaded && <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">SYNCED</span>}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">{p.description || `${p.type} at ${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">TTL: {p.ttl} · Relays: {p.relayCount} · {new Date(p.timestamp).toLocaleTimeString()}</p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button onClick={() => setQrPacket(p)} className="text-[9px] font-black uppercase tracking-widest bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-all">QR</button>
                      <button onClick={() => bleSend(p)} className="text-[9px] font-black uppercase tracking-widest bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-all">BLE</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── BLUETOOTH TAB ── */}
          {activeTab === 'bluetooth' && (
            <div className="p-5 space-y-5">
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-3">Web Bluetooth Relay</p>
                <p className="text-xs text-indigo-700 mb-4 leading-relaxed">
                  Uses <strong>battery_service</strong> GATT characteristic as a data mule. One device writes the SOS packet, the nearby device reads and relays it. Chrome on Android required. HTTPS or localhost only.
                </p>
                <div className="flex gap-3">
                  <button onClick={bleScan} disabled={bleStatus === 'scanning'} className="flex-1 text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all">
                    {bleStatus === 'scanning' ? 'Scanning...' : 'Scan & Receive SOS'}
                  </button>
                  {packets.length > 0 && (
                    <button onClick={() => bleSend(packets[0])} disabled={bleStatus === 'scanning'} className="flex-1 text-[10px] font-black uppercase tracking-widest bg-white border border-indigo-200 text-indigo-700 py-3 rounded-xl hover:bg-indigo-50 transition-all">
                      Send Latest Packet
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-slate-900 rounded-2xl p-4 font-mono text-xs min-h-[160px]">
                <p className="text-slate-400 text-[9px] uppercase tracking-widest mb-2 font-sans font-black">BLE Console</p>
                {bleLog.length === 0 ? <p className="text-slate-600">Awaiting BLE activity...</p> : bleLog.map((l, i) => (
                  <p key={i} className="text-emerald-400 leading-loose">&gt; {l}</p>
                ))}
              </div>
              {bleStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-700 font-bold">
                  Web Bluetooth requires Chrome on Android/Desktop (HTTPS or localhost). Safari and Firefox are not supported.
                </div>
              )}
            </div>
          )}

          {/* ── QR TRANSFER TAB ── */}
          {activeTab === 'qr' && (
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Generate */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-slate-100 pb-2">Generate QR Code</p>
                <p className="text-xs text-slate-500">Select a packet to generate a scannable QR code. The other device scans to import the SOS packet.</p>
                <div className="space-y-2">
                  {packets.slice(0, 5).map(p => (
                    <button key={p.id} onClick={() => setQrPacket(p)}
                      className={`w-full text-left text-xs p-3 rounded-xl border transition-all ${qrPacket?.id === p.id ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                      <span className="font-black">{p.type}</span> — {p.id.slice(-8).toUpperCase()} (TTL: {p.ttl})
                    </button>
                  ))}
                  {packets.length === 0 && <p className="text-xs text-slate-400">No packets. Create one in the Packet Store tab.</p>}
                </div>
                {qrPacket && (
                  <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 flex flex-col items-center gap-3">
                    <canvas ref={canvasRef} className="w-48 h-48 rounded-xl" />
                    <p className="text-[9px] font-mono text-slate-500 text-center break-all max-w-full">{buildQRString(qrPacket).slice(0, 60)}...</p>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Type: {qrPacket.type} · TTL: {qrPacket.ttl}</p>
                  </div>
                )}
              </div>

              {/* Scan/Import */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-slate-100 pb-2">Import from QR Scan</p>
                <p className="text-xs text-slate-500">After scanning a QR with your camera app, paste or type the decoded text below. Format: <code className="bg-slate-100 px-1 rounded">SOS|TYPE|LAT|LNG|TS|ID|TTL|DESC</code></p>
                <textarea value={qrScanInput} onChange={e => setQrScanInput(e.target.value)} rows={5}
                  placeholder="SOS|MEDICAL|19.076|72.877|1700000000|uuid|5|help needed..."
                  className="w-full text-xs font-mono border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-amber-400 resize-none bg-slate-50" />
                <button onClick={importQR} disabled={!qrScanInput.trim()} className="w-full text-[10px] font-black uppercase tracking-widest bg-amber-500 text-white py-3 rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-all">
                  Import Packet
                </button>
                {qrImportResult && (
                  <p className="text-xs font-bold py-2 px-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">{qrImportResult}</p>
                )}
              </div>
            </div>
          )}

          {/* ── WEBRTC TAB ── */}
          {activeTab === 'webrtc' && (
            <div className="p-5 space-y-5">
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-purple-700 mb-2">WebRTC Local Sync</p>
                <p className="text-xs text-purple-700 mb-4 leading-relaxed">
                  Two devices on the same WiFi/hotspot can exchange SOS packets via a WebRTC DataChannel. One device creates an Offer, shares it with the other, which creates an Answer — then packets sync automatically.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-purple-600">Device A — Create Offer</p>
                    <button onClick={createOffer} disabled={rtcStatus !== 'idle'} className="w-full text-[10px] font-black uppercase tracking-widest bg-purple-600 text-white py-3 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-all">
                      Create Offer
                    </button>
                    {rtcOffer && (
                      <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Offer (copy to Device B)</p>
                        <textarea readOnly value={rtcOffer} rows={4} className="w-full text-[10px] font-mono border border-purple-200 rounded-xl px-3 py-2 bg-white resize-none outline-none" />
                        <button onClick={() => navigator.clipboard?.writeText(rtcOffer)} className="text-[9px] font-black text-purple-600 hover:underline mt-1">Copy to clipboard</button>
                      </div>
                    )}
                    {rtcAnswer && (
                      <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Paste Answer from Device B</p>
                        <textarea value={rtcAnswer} onChange={e => setRtcAnswer(e.target.value)} rows={4} className="w-full text-[10px] font-mono border border-purple-200 rounded-xl px-3 py-2 bg-white resize-none outline-none" />
                        <button onClick={setAnswer} className="text-[9px] font-black uppercase tracking-widest bg-purple-100 border border-purple-300 text-purple-700 px-4 py-2 rounded-xl mt-1 hover:bg-purple-200 transition-all">
                          Set Answer
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-purple-600">Device B — Accept Offer</p>
                    <textarea value={rtcOffer} onChange={e => setRtcOffer(e.target.value)} rows={4} placeholder="Paste offer from Device A..." className="w-full text-[10px] font-mono border border-purple-200 rounded-xl px-3 py-2 bg-white resize-none outline-none focus:border-purple-400" />
                    <button onClick={acceptOffer} disabled={!rtcOffer.trim()} className="w-full text-[10px] font-black uppercase tracking-widest bg-white border border-purple-300 text-purple-700 py-3 rounded-xl hover:bg-purple-50 disabled:opacity-50 transition-all">
                      Accept & Create Answer
                    </button>
                    {rtcAnswer && (
                      <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Answer (copy back to Device A)</p>
                        <textarea readOnly value={rtcAnswer} rows={4} className="w-full text-[10px] font-mono border border-purple-200 rounded-xl px-3 py-2 bg-white resize-none outline-none" />
                        <button onClick={() => navigator.clipboard?.writeText(rtcAnswer)} className="text-[9px] font-black text-purple-600 hover:underline mt-1">Copy to clipboard</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-slate-900 rounded-2xl p-4 font-mono text-xs min-h-[140px]">
                <p className="text-slate-400 text-[9px] uppercase tracking-widest mb-2 font-sans font-black">WebRTC Console</p>
                {rtcLog.length === 0 ? <p className="text-slate-600">Awaiting WebRTC activity...</p> : rtcLog.map((l, i) => (
                  <p key={i} className="text-purple-400 leading-loose">&gt; {l}</p>
                ))}
              </div>
            </div>
          )}

          {/* ── SYNC TAB ── */}
          {activeTab === 'sync' && (
            <div className="p-5 space-y-5">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-2">Internet Data Mule Sync</p>
                <p className="text-xs text-emerald-800 mb-4 leading-relaxed">
                  When any device regains internet, all stored SOS packets are uploaded to the ResQNet server at <code className="bg-white/60 px-1 rounded">/api/sos/relay</code>. This acts as a data mule — packets collected from offline devices automatically flow to the server.
                </p>
                <div className="flex gap-3">
                  <button onClick={manualSync} disabled={syncing || !isOnline} className="flex-1 text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all">
                    {syncing ? 'Uploading...' : `Upload ${pendingCount} Pending Packets`}
                  </button>
                </div>
              </div>

              {/* Architecture diagram */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-4">System Architecture</p>
                <div className="flex flex-col gap-2 text-xs font-mono text-slate-600">
                  {[
                    ['Victim Device', 'Creates SOS packet → saves to IndexedDB', 'bg-red-100 text-red-700'],
                    ['BLE / QR / WebRTC', 'Exchanges packets with nearby devices', 'bg-indigo-100 text-indigo-700'],
                    ['Relay Device', 'Stores packets (TTL - 1), deduplicates via seenPackets Set', 'bg-amber-100 text-amber-700'],
                    ['Internet Gateway', 'First device with connectivity uploads all pending packets', 'bg-blue-100 text-blue-700'],
                    ['ResQNet Server', 'Receives relay packets at /api/sos/relay → creates SosAlert records', 'bg-emerald-100 text-emerald-700'],
                  ].map(([title, desc, color], i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex-shrink-0 ${color}`}>{title}</div>
                      {i < 4 && <div className="text-slate-300 self-center">→</div>}
                      <p className="text-[10px] text-slate-500 self-center">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Packet table */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-3">All Stored Packets</p>
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      {['ID', 'Type', 'Source', 'TTL', 'Relays', 'Time', 'Status'].map(h => (
                        <th key={h} className="p-3 text-[9px] font-black uppercase tracking-widest text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {packets.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-3 text-xs font-mono">{p.id.slice(-8).toUpperCase()}</td>
                        <td className="p-3"><span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{p.type}</span></td>
                        <td className="p-3"><SourceBadge source={p.source} /></td>
                        <td className="p-3 text-xs font-black text-slate-700">{p.ttl}</td>
                        <td className="p-3 text-xs text-slate-500">{p.relayCount}</td>
                        <td className="p-3 text-xs text-slate-500">{new Date(p.timestamp).toLocaleTimeString()}</td>
                        <td className="p-3">
                          {p.uploaded
                            ? <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">SYNCED</span>
                            : <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">PENDING</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {packets.length === 0 && <div className="text-center py-8 text-xs text-slate-400 font-bold uppercase tracking-widest">No packets stored</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
