'use client';
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSocket } from '@/hooks/useSocket';

interface MissingPerson {
  id: string; name: string; age?: number; lastSeen: string;
  description: string; photoUrl?: string; status: string; reporterId: string; createdAt: string;
}

export default function MissingPersons() {
  const { user } = useUser();
  const [persons, setPersons] = useState<MissingPerson[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'MISSING' | 'FOUND'>('ALL');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', age: '', lastSeen: '', description: '', photoUrl: '' });

  const fetchPersons = useCallback(async () => {
    const res = await fetch('/api/missing');
    const data = await res.json();
    if (Array.isArray(data)) setPersons(data);
  }, []);

  useEffect(() => { fetchPersons(); }, [fetchPersons]);

  useSocket({
    missing_person: (p: MissingPerson) => setPersons(prev => prev.some(x => x.id === p.id) ? prev : [p, ...prev]),
    person_found: (p: MissingPerson) => setPersons(prev => prev.map(x => x.id === p.id ? p : x)),
  });

  const handleSubmit = async () => {
    if (!form.name || !form.lastSeen) return alert('Name and last seen location are required.');
    setSubmitting(true);
    const userId = (user?.publicMetadata as any)?.dbId || user?.id || 'anonymous';
    try {
      const res = await fetch('/api/missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, reporterId: userId }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ name: '', age: '', lastSeen: '', description: '', photoUrl: '' });
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (e) {
      alert('Network error. Check your connection.');
    }
    setSubmitting(false);
  };

  const handleFound = async (id: string) => {
    const userId = (user?.publicMetadata as any)?.dbId || user?.id || 'volunteer';
    await fetch('/api/missing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, foundBy: userId }),
    });
  };

  const filtered = persons.filter(p => filter === 'ALL' ? true : p.status === filter);
  const missingCount = persons.filter(p => p.status === 'MISSING').length;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 p-4 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="font-black text-slate-900 text-2xl tracking-tighter uppercase">Missing Persons</h1>
            <div className="flex items-center gap-3 mt-1">
              {missingCount > 0 && (
                <span className="bg-red-100 text-red-700 border border-red-200 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full animate-pulse">
                  {missingCount} Still Missing
                </span>
              )}
              <span className="text-slate-400 text-[10px] font-bold uppercase">{persons.length} Total Reports</span>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-red-600 text-white font-black text-[10px] uppercase tracking-[0.2em] px-6 py-3 rounded-xl hover:bg-red-700 transition-all active:scale-95 shadow-sm shadow-red-200"
          >
            Report Missing Person
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(['ALL', 'MISSING', 'FOUND'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-5 py-2.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all ${filter === f
                ? f === 'FOUND' ? 'bg-emerald-600 text-white border-transparent' : f === 'MISSING' ? 'bg-red-600 text-white border-transparent' : 'bg-slate-900 text-white border-transparent'
                : 'bg-white border-slate-200 text-slate-500'}`}>
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-black text-xs uppercase tracking-widest">No reports found</p>
            </div>
          ) : (
            filtered.map(p => (
              <div key={p.id} className={`bg-white rounded-[1.5rem] border-2 p-6 shadow-sm transition-all ${p.status === 'FOUND' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center text-3xl border-2 overflow-hidden bg-slate-100 ${p.status === 'FOUND' ? 'border-emerald-300' : 'border-red-300'}`}>
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        p.status === 'FOUND' ? '✅' : '🔍'
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-slate-900 text-lg tracking-tight">{p.name}</h3>
                        {p.age && <span className="text-slate-500 font-bold text-sm">Age {p.age}</span>}
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${p.status === 'FOUND' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-red-100 text-red-700 border-red-300'}`}>
                          {p.status}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Last Seen</span>
                          <span className="text-slate-700 text-sm font-bold">{p.lastSeen}</span>
                        </div>
                        {p.description && (
                          <div className="flex items-start gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Description</span>
                            <span className="text-slate-600 text-sm font-medium">{p.description}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {p.status === 'MISSING' && (
                    <button
                      onClick={() => handleFound(p.id)}
                      className="shrink-0 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-all active:scale-95 shadow-sm"
                    >
                      Mark Found
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-4 text-right">
                  Reported {new Date(p.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Report Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-end justify-center sm:items-center p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-black text-slate-900 text-xl mb-6 uppercase tracking-tighter">Report Missing Person</h3>
            <div className="space-y-4">
              <div>
                <label className="text-slate-500 font-black text-[10px] uppercase tracking-widest block mb-2">Photo (Preferred)</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden">
                    {form.photoUrl ? <img src={form.photoUrl} className="w-full h-full object-cover" /> : <span className="text-2xl opacity-30">📸</span>}
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setForm(f => ({ ...f, photoUrl: reader.result as string }));
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="flex-1 text-[10px] font-black uppercase text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-500 font-black text-[10px] uppercase tracking-widest block mb-2">Full Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-red-400" placeholder="e.g. Ravi Sharma" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 font-black text-[10px] uppercase tracking-widest block mb-2">Age</label>
                  <input type="number" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-red-400" placeholder="e.g. 12" />
                </div>
                <div>
                  <label className="text-slate-500 font-black text-[10px] uppercase tracking-widest block mb-2">Status</label>
                  <div className="w-full border-2 border-red-500 bg-red-50 text-red-700 rounded-xl px-4 py-3 font-black text-[10px] uppercase tracking-widest flex items-center justify-center">Missing</div>
                </div>
              </div>
              <div>
                <label className="text-slate-500 font-black text-[10px] uppercase tracking-widest block mb-2">Last Seen Location *</label>
                <input value={form.lastSeen} onChange={e => setForm(f => ({ ...f, lastSeen: e.target.value }))} className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-red-400" placeholder="e.g. Sector 7 Flood Shelter" />
              </div>
              <div>
                <label className="text-slate-500 font-black text-[10px] uppercase tracking-widest block mb-2">Description (clothing, features)</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-red-400 resize-none" placeholder="e.g. Blue shirt, ~12 years old, short hair" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => {
                  setShowForm(false);
                  setForm({ name: '', age: '', lastSeen: '', description: '', photoUrl: '' });
                }} 
                className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-red-200">
                {submitting ? 'Broadcasting...' : 'Broadcast Alert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
