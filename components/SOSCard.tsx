'use client';
import { useState } from 'react';
import { timeAgo } from '@/utils/timeAgo';
import { getDirectionsURL } from '@/utils/gps';

const typeColors: Record<string, { badge: string; border: string }> = {
  FOOD:    { badge: 'bg-amber-50 text-amber-700 border-amber-200', border: 'border-amber-200 shadow-amber-50/50' },
  MEDICAL: { badge: 'bg-red-50 text-red-700 border-red-200',       border: 'border-red-200 shadow-red-50/50' },
  RESCUE:  { badge: 'bg-blue-50 text-blue-700 border-blue-200',    border: 'border-blue-200 shadow-blue-50/50' },
};

const urgencyMap: Record<string, string> = {
  LOW:      'bg-emerald-50 text-emerald-800 border-emerald-200',
  MEDIUM:   'bg-amber-50 text-amber-800 border-amber-200',
  CRITICAL: 'bg-red-50 text-red-800 border-red-200',
};

export default function SOSCard({ sos, onAccept, isAccepted, taskId, userLocation, disabled = false, disabledReason }: any) {
  const [showAI, setShowAI] = useState(false);
  const [loading, setLoading] = useState(false);
  const colors = typeColors[sos.type] || typeColors.RESCUE;

  const urgency = sos.aiSuggestion?.includes('CRITICAL') ? 'CRITICAL'
    : sos.aiSuggestion?.includes('MEDIUM') ? 'MEDIUM' : 'LOW';

  async function handleAccept() {
    setLoading(true);
    await onAccept(sos.id);
    setLoading(false);
  }

  return (
    <div className={`bg-white rounded-[2rem] p-6 lg:p-8 mb-6 border-2 transition-all hover:shadow-lg ${colors.border}`}>
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-lg border ${colors.badge}`}>
            {sos.type} UNIT REQ
          </span>
          {sos.description?.includes('via SMS') && (
            <span className="text-[10px] bg-slate-100 text-slate-600 border-slate-200 px-3 py-1.5 rounded-lg border font-black uppercase tracking-[0.2em]">
              SMS RELAY
            </span>
          )}
        </div>
        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">{timeAgo(sos.createdAt)}</span>
      </div>

      <p className="font-black text-slate-900 mb-2 text-xl tracking-tight">{sos.user?.name || 'Unknown Victim'}</p>
      <p className="text-slate-600 text-sm mb-6 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 line-clamp-3">{sos.description}</p>

      {/* Dynamic Children (e.g. ETA Card) */}
      {arguments[0].children}

      {/* AI Suggestion Accordion */}
      {sos.aiSuggestion && (
        <div className="mb-6">
          <button
            onClick={() => setShowAI(!showAI)}
            className={`w-full text-left px-5 py-3 text-[10px] uppercase tracking-[0.2em] font-black rounded-xl border-2 transition-all flex justify-between items-center ${urgencyMap[urgency]}`}
          >
            <span className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${urgency === 'CRITICAL' ? 'bg-red-500 animate-pulse' : urgency === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              AI INTELLIGENCE ({urgency})
            </span>
            <span className="font-mono text-lg leading-none">{showAI ? '-' : '+'}</span>
          </button>
          
          {showAI && (
            <div className="mt-3 p-5 bg-white border-2 border-slate-100 rounded-2xl text-xs text-slate-700 font-medium whitespace-pre-wrap leading-relaxed shadow-sm">
              {sos.aiSuggestion}
            </div>
          )}
        </div>
      )}

      {isAccepted ? (
        <div className="flex gap-3 mt-6">
          <a
            href={getDirectionsURL(sos.lat, sos.lng, sos.type, userLocation)}
            target="_blank" rel="noreferrer"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-700 text-center text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-xl transition-all shadow-md active:scale-95"
          >
            NAVIGATE ROUTE
          </a>
        </div>
      ) : (
        <button
          onClick={handleAccept}
          disabled={loading || sos.status === 'ASSIGNED' || disabled}
          className={`w-full mt-4 py-4 rounded-xl transition-all shadow-md active:scale-95 text-[10px] uppercase tracking-[0.2em] font-black border-2 ${
            (sos.status === 'ASSIGNED' || disabled)
              ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed shadow-none' 
              : 'bg-slate-900 border-slate-900 hover:bg-slate-800 text-white'
          }`}
        >
          {loading ? 'INITIALIZING...' : (disabled ? disabledReason : (sos.status === 'ASSIGNED' ? 'UNIT DISPATCHED' : 'ACCEPT MISSION DEPLOYMENT'))}
        </button>
      )}
    </div>
  );
}
