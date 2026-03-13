'use client';
import { useState } from 'react';
import { timeAgo } from '@/utils/timeAgo';
import { getDirectionsURL } from '@/utils/gps';

const typeColors: Record<string, { badge: string; border: string }> = {
  FOOD:    { badge: 'bg-yellow-100 text-yellow-800 border-yellow-200', border: 'border-yellow-200 shadow-yellow-100/50' },
  MEDICAL: { badge: 'bg-red-100 text-red-800 border-red-200',          border: 'border-red-200 shadow-red-100/50' },
  RESCUE:  { badge: 'bg-blue-100 text-blue-800 border-blue-200',       border: 'border-blue-200 shadow-blue-100/50' },
};

const urgencyMap = {
  LOW:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  MEDIUM:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  CRITICAL: 'bg-red-50 text-red-700 border-red-200 animate-pulse',
};

export default function SOSCard({ sos, onAccept, isAccepted, taskId, userLocation }: any) {
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
    <div className={`bg-white rounded-3xl p-5 mb-4 border shadow-sm transition-all hover:shadow-md ${colors.border}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${colors.badge}`}>
            {sos.type === 'MEDICAL' ? '🏥' : sos.type === 'FOOD' ? '🍱' : '🚁'} {sos.type}
          </span>
          {sos.description?.includes('via SMS') && (
            <span className="text-[10px] bg-purple-100 text-purple-700 border-purple-200 px-2.5 py-1 rounded-md border font-black uppercase tracking-widest">
              📱 SMS
            </span>
          )}
        </div>
        <span className="text-slate-400 text-xs font-bold">{timeAgo(sos.createdAt)}</span>
      </div>

      <p className="font-bold text-slate-900 mb-1 text-lg tracking-tight">{sos.user?.name}</p>
      <p className="text-slate-600 text-sm mb-4 leading-relaxed line-clamp-2">{sos.description}</p>

      {/* Dynamic Children (e.g. ETA Card) */}
      {arguments[0].children}

      {/* AI Suggestion Accordion */}
      {sos.aiSuggestion && (
        <div className="mb-4">
          <button
            onClick={() => setShowAI(!showAI)}
            className={`w-full text-left px-4 py-2 text-xs font-bold rounded-xl border transition-all flex justify-between items-center ${urgencyMap[urgency]}`}
          >
            <span className="flex items-center gap-2">🤖 AI Analysis ({urgency})</span>
            <span>{showAI ? '▲' : '▼'}</span>
          </button>
          
          {showAI && (
            <div className="mt-2 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 whitespace-pre-wrap leading-relaxed shadow-inner">
              {sos.aiSuggestion}
            </div>
          )}
        </div>
      )}

      {isAccepted ? (
        <div className="flex gap-2 mt-4">
          <a
            href={getDirectionsURL(sos.lat, sos.lng, sos.type, userLocation)}
            target="_blank" rel="noreferrer"
            className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-center text-sm font-bold py-3 rounded-xl transition-all shadow-sm active:scale-95"
          >
            🗺️ Navigate
          </a>
          {sos.user?.phone && !sos.user.phone.includes('No phone') ? (
            <a
              href={`tel:${sos.user.phone}`}
              className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-center text-sm font-bold py-3 rounded-xl transition-all shadow-sm active:scale-95"
            >
              📞 Call
            </a>
          ) : (
            <button
              disabled
              className="flex-1 bg-slate-50 text-slate-300 border border-slate-100 text-center text-sm font-bold py-3 rounded-xl cursor-not-allowed"
            >
              📵 No Phone
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={handleAccept}
          disabled={loading || sos.status === 'ASSIGNED'}
          className={`w-full mt-2 text-sm font-bold py-3 rounded-xl transition-all shadow-md active:scale-95 ${
            sos.status === 'ASSIGNED' 
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
              : 'bg-slate-900 hover:bg-slate-800 text-white'
          }`}
        >
          {loading ? 'Processing...' : sos.status === 'ASSIGNED' ? 'Already Assigned' : 'Accept Mission'}
        </button>
      )}
    </div>
  );
}
