'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '@/hooks/useChat';

interface LiveChatProps {
  sosId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
}

export default function LiveChat({ sosId, currentUserId, currentUserName, currentUserRole }: LiveChatProps) {
  const [input, setInput]         = useState('');
  const [sending, setSending]     = useState(false);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);

  const { messages, hasMore, typingUsers, loadEarlier, sendMessage, emitTyping } = useChat(sosId, currentUserId);

  // Localized scroll to bottom on new messages
  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    emitTyping(false, currentUserName);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    await sendMessage(input.trim(), currentUserName, currentUserRole);
    setInput('');
    setSending(false);
  }, [input, sending, sendMessage, currentUserName, currentUserRole, emitTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    emitTyping(true, currentUserName);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false, currentUserName), 2000);
  };

  const typingList = Object.values(typingUsers);

  function getBubbleStyle(role: string, isMe: boolean) {
    if (role === 'SYSTEM' || role === 'AI') return '';
    if (isMe) return 'bg-blue-600 text-white shadow-sm border border-blue-500';
    if (role === 'VOLUNTEER' || role === 'NGO') return 'bg-slate-800 text-slate-50 border border-slate-900';
    if (role === 'VICTIM') return 'bg-slate-100 border border-slate-200 text-slate-800';
    return 'bg-white border-2 border-slate-100 text-slate-700 shadow-sm';
  }

  return (
    <div className="bg-white border-2 border-slate-200 rounded-[2rem] flex flex-col overflow-hidden shadow-sm" style={{ height: 460 }}>
      {/* Header */}
      <div className="px-6 py-5 border-b-2 border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <p className="text-slate-900 text-sm font-black uppercase tracking-[0.2em]">Mission Comms</p>
        </div>
        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest border border-slate-200 px-2.5 py-1 rounded-lg bg-white">Live Channel</span>
      </div>

      {/* Messages */}
      <div ref={messageContainerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-white custom-scrollbar flex flex-col">
        {hasMore && (
          <button
            onClick={loadEarlier}
            className="w-full text-center text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 hover:text-blue-700 py-3 border-2 border-blue-50 rounded-xl hover:bg-blue-50 transition-all"
          >
            Load History Log
          </button>
        )}

        {messages.length === 0 && (
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto bg-slate-50 border-2 border-slate-200 rounded-full flex items-center justify-center mb-4">
              <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" />
            </div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">COMMS SILENT</p>
            <p className="text-slate-500 text-xs mt-2 font-medium">Channel activates upon engagement</p>
          </div>
        )}

        {messages.map((m) => {
          if (m.messageType === 'SYSTEM') {
            return (
              <div key={m.id} className="flex justify-center my-4">
                <span className="text-[12px] text-slate-600 bg-white border-2 border-slate-200 px-6 py-2 rounded-2xl font-black uppercase tracking-[0.2em] shadow-sm">
                   📢 {m.message}
                </span>
              </div>
            );
          }

          if (m.messageType === 'AI') {
            return (
              <div key={m.id} className="flex justify-center my-6 w-full">
                <div className="bg-blue-600 border-4 border-blue-400 text-white text-[15px] px-6 py-5 rounded-[2.5rem] max-w-[95%] shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-20">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/></svg>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-200 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_8px_white]" />
                    AI Commander Advice
                  </p>
                  <p className="leading-relaxed font-black italic tracking-tight">{m.message}</p>
                </div>
              </div>
            );
          }

          // Smarter "isMe" for demoing: Must match BOTH ID and Role
          // This allows testing with 1 account in 2 windows (Victim/Volunteer)
          const isMe = (String(m.senderId).trim() === String(currentUserId).trim()) && (m.senderRole === currentUserRole);
          const bubbleClass = getBubbleStyle(m.senderRole, isMe);

          return (
            <div key={m.id} className={`flex w-full mb-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-5 py-3 text-[16px] shadow-sm relative group ${bubbleClass} 
                ${isMe 
                  ? 'rounded-3xl rounded-tr-none ml-auto' 
                  : 'rounded-3xl rounded-tl-none mr-auto'
                }`}
              >
                {!isMe && (
                  <p className={`text-[11px] font-black uppercase tracking-widest mb-1 ${m.senderRole === 'VICTIM' ? 'text-slate-500' : 'text-slate-200/90'}`}>
                    {m.senderName || 'Anonymous'} <span className="opacity-80 ml-1 px-2 py-0.5 bg-black/30 rounded uppercase font-black text-[9px]">{m.senderRole}</span>
                  </p>
                )}
                <p className="leading-snug whitespace-pre-wrap font-black tracking-tighter">{m.message}</p>
                <div className={`flex items-center justify-between mt-1.5 opacity-60 group-hover:opacity-90 transition-opacity ${isMe ? 'flex-row-reverse' : ''}`}>
                  <span className="text-[10px] font-bold">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMe && <span className="text-[10px] ml-1.5">✓✓</span>}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingList.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-slate-50 border-2 border-slate-100 px-5 py-3 rounded-[1rem]">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.1em] flex items-center gap-2">
                <span>{typingList.join(', ')} {typingList.length === 1 ? 'is' : 'are'} transmitting</span>
                <span className="flex gap-1 items-end ml-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-5 pb-5 pt-3 border-t-2 border-slate-100 bg-white">
        <div className="flex gap-3 items-end bg-slate-50 border-2 border-slate-200 focus-within:border-slate-400 focus-within:bg-white rounded-[1.5rem] p-3 transition-all">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Transmit message..."
            rows={1}
            className="flex-1 bg-transparent text-slate-900 text-sm px-3 py-2 outline-none placeholder:text-slate-400 font-medium resize-none max-h-24 custom-scrollbar"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black px-6 py-4 rounded-xl text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 shrink-0 shadow-sm"
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}
