'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useSosEventRealtime } from '@/hooks/useSosEventRealtime';

interface SosEvent {
  id: string; sosId: string; event: string; actor?: string; actorName?: string; metadata?: string; createdAt: string;
}

const STATUS_OPTIONS = [
  { value: 'STILL_TRAPPED',    label: 'Still Trapped',      emoji: '🪤', color: 'bg-red-600',     text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-300'    },
  { value: 'INJURED',          label: 'Injured but Safe',   emoji: '🤕', color: 'bg-orange-500',  text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300' },
  { value: 'ESCAPED',          label: 'Escaped',            emoji: '🏃', color: 'bg-emerald-600', text: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-300'},
  { value: 'NEED_EVACUATION',  label: 'Need Evacuation',    emoji: '🚁', color: 'bg-blue-600',    text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-300'   },
];

const EVENT_META: Record<string, { label: string; emoji: string; color: string }> = {
  SOS_CREATED:          { label: 'SOS Created',             emoji: '🆘', color: 'text-red-600'     },
  PACKET_RELAYED:       { label: 'Packet Relayed',          emoji: '📡', color: 'text-blue-600'    },
  VOLUNTEER_DETECTED:   { label: 'Volunteer Detected',      emoji: '👀', color: 'text-yellow-600'  },
  MISSION_ACCEPTED:     { label: 'Mission Accepted',        emoji: '✅', color: 'text-emerald-600' },
  STATUS_UPDATE:        { label: 'Status Update',           emoji: '📢', color: 'text-slate-600'   },
  RESCUE_COMPLETED:     { label: 'Rescue Completed',        emoji: '🎉', color: 'text-emerald-700' },
  STILL_TRAPPED:        { label: 'Still Trapped',           emoji: '🪤', color: 'text-red-600'     },
  INJURED:              { label: 'Injured But Safe',        emoji: '🤕', color: 'text-orange-600'  },
  ESCAPED:              { label: 'Escaped',                 emoji: '🏃', color: 'text-emerald-600' },
  NEED_EVACUATION:      { label: 'Needs Evacuation',        emoji: '🚁', color: 'text-blue-600'    },
};

interface Props {
  sosId: string;
  currentUserId: string;
  currentUserName: string;
  showStatusButtons?: boolean; // only for victims
}

export default function StatusTimeline({ sosId, currentUserId, currentUserName, showStatusButtons = false }: Props) {
  const [events, setEvents] = useState<SosEvent[]>([]);
  const [posting, setPosting] = useState(false);

  const fetchEvents = useCallback(async () => {
    const res = await fetch(`/api/sos/${sosId}/events`);
    const data = await res.json();
    if (Array.isArray(data)) setEvents(data);
  }, [sosId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useSocket({
    sos_event: (newEvent: any) => {
      if (newEvent.sosId === sosId) {
        setEvents((prev) => {
          if (prev.find(e => e.id === newEvent.id)) return prev;
          return [...prev, newEvent].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        });
      }
    }
  });

  useSosEventRealtime(sosId, fetchEvents);

  const postStatusUpdate = async (status: string) => {
    setPosting(true);
    await fetch(`/api/sos/${sosId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: status, actor: currentUserId, actorName: currentUserName }),
    });
    setPosting(false);
  };

  return (
    <div className="bg-white border-2 border-slate-200 rounded-4xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b-2 border-slate-100 bg-slate-50 flex items-center gap-3">
        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
        <h3 className="font-black text-slate-900 text-sm uppercase tracking-[0.2em]">Incident Timeline</h3>
        <span className="ml-auto text-[9px] text-slate-400 font-black uppercase tracking-widest border border-slate-200 px-2 py-0.5 rounded-md bg-white">{events.length} Events</span>
      </div>

      {/* Status update buttons for victim */}
      {showStatusButtons && (
        <div className="px-6 py-4 border-b border-slate-100 bg-white">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Update Your Status</p>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map(s => (
              <button key={s.value} onClick={() => postStatusUpdate(s.value)} disabled={posting}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 ${s.border} ${s.bg} ${s.text} text-[10px] font-black uppercase tracking-wider transition-all hover:opacity-90 active:scale-95 disabled:opacity-50`}>
                <span className="text-base">{s.emoji}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="px-6 py-6 max-h-80 overflow-y-auto custom-scrollbar">
        {events.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Timeline starts when SOS is created</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
            
            <div className="space-y-4">
              {events.map((ev, i) => {
                const meta = EVENT_META[ev.event] || { label: ev.event, emoji: '📌', color: 'text-slate-600' };
                return (
                  <div key={ev.id} className="flex gap-4 items-start relative">
                    {/* Dot */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 z-10 shadow-sm border-2 border-white ${i === events.length - 1 ? 'bg-slate-900' : 'bg-white border-slate-200'}`}>
                      {meta.emoji}
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className={`font-black text-sm ${meta.color}`}>{meta.label}</span>
                        <span className="text-[10px] text-slate-400 font-bold">
                          {new Date(ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {ev.actorName && ev.actorName !== 'System' && (
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">by {ev.actorName}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
