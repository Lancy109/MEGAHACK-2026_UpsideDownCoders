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
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);

  const { messages, hasMore, typingUsers, loadEarlier, sendMessage, emitTyping } = useChat(sosId, currentUserId);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    if (role === 'SYSTEM') return null; // handled separately
    if (role === 'AI') return null;
    if (isMe) return 'bg-blue-600 text-white shadow-md ml-auto border border-blue-600';
    if (role === 'VOLUNTEER') return 'bg-slate-100 border border-slate-200 text-slate-800';
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
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-white custom-scrollbar">
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
          const isMe = m.senderId === currentUserId;

          if (m.messageType === 'SYSTEM') {
            return (
              <div key={m.id} className="flex justify-center">
                <span className="text-[10px] text-slate-400 italic bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full font-medium">
                  {m.message}
                </span>
              </div>
            );
          }

          if (m.messageType === 'AI') {
            return (
              <div key={m.id} className="flex justify-center">
                <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-4 py-3 rounded-xl max-w-xs text-center font-medium">
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-1">AI Guidance</p>
                  {m.message}
                </div>
              </div>
            );
          }

          const bubbleClass = getBubbleStyle(m.senderRole, isMe);

          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm ${bubbleClass}`}>
                {!isMe && (
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-slate-500">
                    {m.senderName} <span className="opacity-50">· {m.senderRole}</span>
                  </p>
                )}
                <p className="leading-relaxed whitespace-pre-wrap">{m.message}</p>
                <p className="text-[9px] text-right opacity-40 mt-1 font-medium">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
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
        <div ref={bottomRef} className="h-1" />
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
