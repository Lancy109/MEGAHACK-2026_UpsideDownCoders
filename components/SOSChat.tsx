'use client';
import { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';

export default function SOSChat({ sosId, currentUserId, currentUserName, currentUserRole }: { 
  sosId: string, 
  currentUserId: string, 
  currentUserName: string, 
  currentUserRole: string 
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput]       = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  
  const socket = useSocket({
    new_message: (msg: any) => {
      if (msg.sosId === sosId) {
        setMessages(prev => [...prev, msg]);
      }
    },
  });

  useEffect(() => {
    if (!sosId || !socket) return;
    
    // Join the SOS room
    socket.emit('join_sos_room', sosId);
    
    // Load history
    fetch(`/api/chat?sosId=${sosId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMessages(data);
      });
  }, [sosId, socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim()) return;
    const body = {
      sosId, 
      senderId: currentUserId,
      senderName: currentUserName, 
      senderRole: currentUserRole,
      message: input.trim(),
    };
    
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setInput('');
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl flex flex-col overflow-hidden shadow-2xl" style={{ height: '400px' }}>
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <p className="text-white text-sm font-black uppercase tracking-widest">Mission Comms</p>
        </div>
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Encrypted Channel</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-hide">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4 opacity-20">💬</div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">No transmissions yet</p>
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.senderId === currentUserId;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} slide-in`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                isMe 
                  ? 'bg-blue-600 text-white rounded-br-none shadow-lg shadow-blue-900/20' 
                  : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
              }`}>
                {!isMe && (
                  <p className="text-[10px] text-emerald-400 mb-1 font-black uppercase tracking-tighter">
                    {m.senderName} ({m.senderRole})
                  </p>
                )}
                <p className="font-medium leading-relaxed">{m.message}</p>
                <p className={`text-[9px] mt-1 text-right opacity-50 font-bold`}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-4 bg-slate-900/50">
        <div className="flex gap-2 bg-slate-800 p-2 rounded-2xl border border-slate-700 focus-within:border-blue-500 transition-all">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-transparent text-white text-sm px-2 py-1 outline-none placeholder:text-slate-600 font-medium"
          />
          <button onClick={sendMessage}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2 rounded-xl text-xs transition-all shadow-md active:scale-95"
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}
