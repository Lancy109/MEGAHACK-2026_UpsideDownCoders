'use client';
import { useState } from 'react';

const GUIDE_DATA = [
  {
    id: 'bleeding',
    title: 'Bleeding Control',
    emoji: '🩸',
    severity: 'CRITICAL',
    severityColor: 'bg-red-600',
    steps: [
      'Stay calm and wear gloves if available.',
      'Apply firm, direct pressure on the wound using a clean cloth or bandage.',
      'Do NOT remove the cloth — add more material on top if soaked.',
      'Elevate the injured area above the heart if possible.',
      'If bleeding is from a limb, consider applying a tourniquet 5cm above the wound.',
      'Seek medical help immediately.',
    ],
    warning: 'If blood spurts or is bright red, it may be arterial — apply maximum pressure.',
  },
  {
    id: 'fractures',
    title: 'Fractures & Broken Bones',
    emoji: '🦴',
    severity: 'HIGH',
    severityColor: 'bg-orange-500',
    steps: [
      'Do NOT attempt to straighten or realign the bone.',
      'Immobilize the injured area using a splint (board, stick, or rolled newspaper).',
      'Pad the splint with soft material for comfort.',
      'Secure the splint with bandages or cloth — NOT too tight.',
      'Apply ice pack wrapped in cloth to reduce swelling.',
      'Elevate the injured limb if possible.',
      'Do not give food or drink (surgery may be needed).',
    ],
    warning: 'If the bone has pierced the skin, cover with a clean cloth. Do NOT push it back in.',
  },
  {
    id: 'cpr',
    title: 'CPR (Cardiopulmonary Resuscitation)',
    emoji: '❤️',
    severity: 'CRITICAL',
    severityColor: 'bg-red-600',
    steps: [
      'Check the scene is safe. Tap the person and shout "Are you okay?"',
      'Call emergency services (or ask someone to call).',
      'Place heel of hand on center of chest (lower half of sternum).',
      'Place other hand on top, fingers interlocked.',
      'Give 30 CHEST COMPRESSIONS — push down at least 5cm at a rate of 100-120/min.',
      'Tilt head back and lift chin. Pinch the nose closed.',
      'Give 2 RESCUE BREATHS — each breath should last 1 second and make the chest rise.',
      'REPEAT the cycle: 30 compressions then 2 breaths.',
      'Continue until person recovers, emergency arrives, or you are exhausted.',
    ],
    warning: 'If not trained in rescue breathing, do HANDS-ONLY CPR (compressions only) continuously.',
  },
  {
    id: 'burns',
    title: 'Burns Treatment',
    emoji: '🔥',
    severity: 'HIGH',
    severityColor: 'bg-orange-500',
    steps: [
      'Remove the person from the source of heat/fire.',
      'Cool the burn under cool (NOT ice cold) running water for 20 minutes.',
      'Remove jewelry and clothing near the burn — unless stuck to skin.',
      'Do NOT apply butter, oil, toothpaste, or ice — these make it worse.',
      'Cover with a clean non-fluffy bandage or cling film.',
      'Do NOT break blisters.',
      'For electrical burns — ensure power is OFF before touching person.',
      'Seek urgent medical attention for burns larger than the palm or on face/hands/genitals.',
    ],
    warning: 'Chemical burns: flush with water for 20+ minutes. Remove contaminated clothing carefully.',
  },
  {
    id: 'shock',
    title: 'Shock Treatment',
    emoji: '⚡',
    severity: 'CRITICAL',
    severityColor: 'bg-red-600',
    steps: [
      'Call emergency services immediately.',
      'Lay the person flat on their back.',
      'Raise legs 30cm above heart level (unless head, neck, or spine injury is suspected).',
      'Keep the person warm using a blanket or jacket.',
      'Do NOT give food or water.',
      'Loosen tight clothing around neck, chest, and waist.',
      'If unconscious but breathing, place in recovery position (on side).',
      'Monitor breathing and pulse until help arrives.',
    ],
    warning: 'Signs of shock: pale/cold skin, rapid pulse, confusion, dizziness. Act immediately.',
  },
];

export default function FirstAidGuide() {
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = GUIDE_DATA.filter(g =>
    g.title.toLowerCase().includes(search.toLowerCase()) ||
    g.steps.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 p-4 lg:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-red-50 border-2 border-red-200 rounded-2xl flex items-center justify-center text-2xl">🚑</div>
              <div>
                <h1 className="font-black text-slate-900 text-2xl tracking-tighter uppercase">Emergency First Aid</h1>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Offline Available • Works Without Internet</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const content = GUIDE_DATA.map(g => `${g.emoji} ${g.title}\n${'='.repeat(20)}\n\n⚠️ IMPORTANT: ${g.warning}\n\nSteps:\n${g.steps.map((s, i) => `${i+1}. ${s}`).join('\n')}\n\n`).join('\n---\n\n');
                  const blob = new Blob([content], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'ResQNet_Emergency_FirstAid_Guide.txt';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex-1 md:flex-none bg-red-600 text-white font-black text-[10px] uppercase tracking-widest px-6 py-4 rounded-2xl hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-red-200"
              >
                📥 Download Guide
              </button>
            </div>
          </div>
          
          <input
            type="text"
            placeholder="Search guide (e.g. bleeding, cpr)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-5 py-3 text-slate-900 font-medium outline-none focus:border-slate-400 transition-all"
          />
        </div>

        {/* Severity Legend */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {[{ label: 'Critical — Life Threatening', c: 'bg-red-600' }, { label: 'High Priority', c: 'bg-orange-500' }].map(s => (
            <div key={s.label} className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${s.c}`} />
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Guide Cards */}
        <div className="space-y-4">
          {filtered.map(guide => (
            <div key={guide.id} className="bg-white rounded-[1.5rem] border-2 border-slate-200 overflow-hidden shadow-sm">
              <button
                onClick={() => setOpen(open === guide.id ? null : guide.id)}
                className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-slate-50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{guide.emoji}</span>
                  <div>
                    <h3 className="font-black text-slate-900 text-base tracking-tight">{guide.title}</h3>
                    <span className={`inline-block text-[9px] font-black uppercase tracking-widest text-white px-3 py-0.5 rounded-full mt-1 ${guide.severityColor}`}>
                      {guide.severity}
                    </span>
                  </div>
                </div>
                <span className={`text-slate-400 font-black text-xl transition-transform duration-300 ${open === guide.id ? 'rotate-180' : ''}`}>
                  ↓
                </span>
              </button>

              {open === guide.id && (
                <div className="px-6 pb-6">
                  {/* Warning box */}
                  <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl px-5 py-4 mb-5">
                    <p className="text-amber-800 text-xs font-black uppercase tracking-widest mb-1">⚠️ IMPORTANT</p>
                    <p className="text-amber-700 text-sm font-medium">{guide.warning}</p>
                  </div>

                  {/* Steps */}
                  <div className="space-y-3">
                    {guide.steps.map((step, i) => (
                      <div key={i} className="flex gap-4 items-start p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-black text-sm shrink-0">
                          {i + 1}
                        </div>
                        <p className="text-slate-700 text-sm font-medium leading-relaxed pt-1">{step}</p>
                      </div>
                    ))}
                  </div>

                  {/* Step count badge */}
                  <div className="mt-4 text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {guide.steps.length} Steps • Memorize for offline use
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Offline notice */}
        <div className="mt-6 text-center bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <p className="text-emerald-700 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            This guide is fully available offline via PWA service worker
          </p>
        </div>
      </div>
    </div>
  );
}
