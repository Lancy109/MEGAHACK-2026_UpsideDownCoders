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
    if (isMe) return 'bg-red-50 border border-red-200 text-slate-800 ml-auto';
    if (role === 'VOLUNTEER') return 'bg-blue-50 border border-blue-200 text-slate-800';
    return 'bg-slate-100 border border-slate-200 text-slate-700';
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm" style={{ height: 420 }}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <p className="text-slate-900 text-sm font-black uppercase tracking-widest">Mission Comms</p>
        </div>
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Live Channel</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {hasMore && (
          <button
            onClick={loadEarlier}
            className="w-full text-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 py-2 border border-slate-100 rounded-xl hover:border-slate-200 transition-all"
          >
            Load earlier messages
          </button>
        )}

        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">No messages yet</p>
            <p className="text-slate-300 text-[10px] mt-1">Chat becomes active when a volunteer responds</p>
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
            <div className="bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-2xl">
              <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5">
                <span>{typingList.join(', ')} {typingList.length === 1 ? 'is' : 'are'} typing</span>
                <span className="flex gap-0.5 items-end">
                  <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-white">
        <div className="flex gap-2 items-end bg-slate-50 border border-slate-200 focus-within:border-slate-400 focus-within:bg-white rounded-xl p-2 transition-all">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 bg-transparent text-slate-900 text-sm px-2 py-1 outline-none placeholder:text-slate-400 font-medium resize-none max-h-24"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="bg-slate-900 hover:bg-slate-700 disabled:opacity-30 text-white font-black px-4 py-2 rounded-lg text-xs transition-all active:scale-95 shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
