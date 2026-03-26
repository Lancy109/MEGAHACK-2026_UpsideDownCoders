'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '@/hooks/useChat';

interface LiveChatProps {
  sosId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
}

const QUICK_REPLIES: Record<string, string[]> = {
  VOLUNTEER: [
    'I am on my way to you.',
    'I have accepted your request.',
    'Please stay where you are.',
    'Estimated arrival in 10 minutes.',
    'I am 5 minutes away.',
  ],
  VICTIM: [
    'I am on the rooftop.',
    'There are 3 people here.',
    'We have a medical emergency.',
    'We are running out of water.',
    'Please hurry.',
  ],
  NGO: [
    'Rescue team has been dispatched.',
    'Additional resources are coming.',
    'Please remain calm.',
    'Authorities have been notified.',
  ],
};

const ROLE_LABEL: Record<string, string> = {
  VICTIM:    'bg-red-100 text-red-700',
  VOLUNTEER: 'bg-blue-100 text-blue-700',
  NGO:       'bg-slate-100 text-slate-700',
  SYSTEM:    'bg-gray-100 text-gray-500',
};

const ROLE_BUBBLE: Record<string, string> = {
  VICTIM:    'bg-red-600 text-white',
  VOLUNTEER: 'bg-blue-600 text-white',
  NGO:       'bg-slate-700 text-white',
};

export default function LiveChat({
  sosId,
  currentUserId,
  currentUserName,
  currentUserRole,
}: LiveChatProps) {
  const [input, setInput]       = useState('');
  const [showQuick, setShowQuick] = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);

  const {
    messages,
    loading,
    sending,
    hasMore,
    loadingMore,
    typingUsers,
    supabaseStatus,
    socketConnected,
    loadEarlier,
    sendMessage,
    emitTyping,
    refresh,
    refreshing,
  } = useChat(sosId, currentUserId);

  // Auto-scroll logic removed as per request
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  }, []);

  const handleSend = useCallback(async (messageText?: string) => {
    const msg = messageText || input.trim();
    if (!msg || sending) return;
    setInput('');
    setShowQuick(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    emitTyping(false, currentUserName);
    await sendMessage(msg, currentUserName, currentUserRole);
    // Manually scroll to bottom only when user sends a message
    setTimeout(() => scrollToBottom('smooth'), 100);
  }, [input, sending, sendMessage, currentUserName, currentUserRole, emitTyping, scrollToBottom]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    emitTyping(true, currentUserName);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false, currentUserName), 2000);
  };

  const typingList = Object.values(typingUsers);
  const quickReplies = QUICK_REPLIES[currentUserRole] || QUICK_REPLIES.VOLUNTEER;

  if (loading) return (
    <div className="flex items-center justify-center h-48 bg-white border border-gray-200 rounded-2xl">
      <div className="flex gap-1.5">
        {[0, 150, 300].map(d => (
          <div key={d} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col bg-white border-2 border-slate-200 rounded-4xl overflow-hidden shadow-sm h-[400px] sm:h-[460px]">

      {/* HEADER */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${
            (socketConnected || supabaseStatus === 'SUBSCRIBED') ? 'bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]' :
            supabaseStatus === 'unconfigured' && !socketConnected ? 'bg-slate-300' : 'bg-amber-400 animate-pulse'
          }`} />
          <p className="text-slate-900 text-sm font-black uppercase tracking-widest">Mission Comms</p>
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            {(socketConnected || supabaseStatus === 'SUBSCRIBED') ? 'Live' :
             supabaseStatus === 'unconfigured' && !socketConnected ? 'Offline mode' : 'Connecting'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            disabled={refreshing}
            className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
              refreshing ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-70 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Refresh messages"
          >
            <span className={`text-blue-500 transition-transform duration-500 ${refreshing ? 'animate-spin' : ''}`}>↻</span> 
            {refreshing ? 'Syncing...' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowQuick(q => !q)}
            className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all ${
              showQuick
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Quick Replies
          </button>
        </div>
      </div>

      {/* QUICK REPLIES STRIP */}
      {showQuick && (
        <div className="flex gap-2 px-5 py-2 border-b border-slate-100 overflow-x-auto shrink-0 bg-slate-50">
          {quickReplies.map(q => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="shrink-0 text-xs bg-white border border-slate-200 hover:border-slate-400 text-slate-700 px-3 py-1.5 rounded-full transition font-medium whitespace-nowrap"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3 bg-white custom-scrollbar flex flex-col">
        {hasMore && (
          <button
            onClick={loadEarlier}
            disabled={loadingMore}
            className="w-full text-center text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 py-2.5 border border-blue-100 rounded-xl hover:bg-blue-50 transition-all"
          >
            {loadingMore ? 'Loading...' : 'Load earlier messages'}
          </button>
        )}

        {messages.length === 0 && (
          <div className="text-center py-16 m-auto">
            <div className="w-12 h-12 mx-auto bg-slate-50 border-2 border-slate-200 rounded-full flex items-center justify-center mb-4">
              <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" />
            </div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">COMMS SILENT</p>
            <p className="text-slate-400 text-xs mt-1.5 font-medium">Channel activates upon engagement</p>
          </div>
        )}

        {messages.map((m, i) => {
          const isOwn    = String(m.senderId).trim() === String(currentUserId).trim() && m.senderRole === currentUserRole;
          const isSystem = m.messageType === 'SYSTEM';
          const isAI     = m.messageType === 'AI';
          const showSender = i === 0 || messages[i - 1].senderId !== m.senderId || messages[i - 1].senderRole !== m.senderRole;
          const showTime   = i === messages.length - 1 || messages[i + 1].senderId !== m.senderId;
          const roleLabel  = ROLE_LABEL[m.senderRole] || ROLE_LABEL.SYSTEM;
          const roleBubble = ROLE_BUBBLE[m.senderRole] || 'bg-slate-700 text-white';

          if (isSystem) return (
            <div key={m.id} className="flex justify-center">
              <span className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-4 py-1.5 rounded-full font-semibold">
                {m.message}
              </span>
            </div>
          );

          if (isAI) return (
            <div key={m.id} className="flex justify-center w-full">
              <div className="bg-blue-600 text-white px-5 py-4 rounded-2xl max-w-[95%] shadow-md">
                <p className="text-[9px] font-black uppercase tracking-widest text-blue-200 mb-1.5">AI Recommendation</p>
                <p className="text-sm leading-relaxed font-medium">{m.message}</p>
              </div>
            </div>
          );

          return (
            <div key={m.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
              {showSender && !isOwn && (
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${roleLabel}`}>
                    {m.senderName}
                  </span>
                  <span className="text-slate-300 text-[9px] uppercase font-bold">{m.senderRole}</span>
                </div>
              )}
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                isOwn
                  ? `${roleBubble} rounded-tr-none ${m.optimistic ? 'opacity-60' : ''}`
                  : 'bg-slate-100 text-slate-900 rounded-tl-none'
              }`}>
                {m.message}
              </div>
              {showTime && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-slate-300 text-[10px]">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isOwn && (
                    <span className="text-slate-300 text-[10px]">
                      {m.optimistic ? 'Sending...' :
                       m.status === 'failed' ? 'Failed' :
                       m.readBy && m.readBy.length > 1 ? 'Read' : 'Sent'}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingList.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2">
              <span className="text-slate-400 text-[11px] font-medium">
                {typingList.join(', ')} {typingList.length === 1 ? 'is' : 'are'} typing
              </span>
              <span className="flex gap-1">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div className="px-5 pb-5 pt-3 border-t border-slate-100 bg-white shrink-0">
        <div className="flex gap-3 items-end bg-slate-50 border border-slate-200 focus-within:border-slate-400 focus-within:bg-white rounded-2xl p-3 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send)"
            rows={1}
            className="flex-1 bg-transparent text-slate-900 text-sm px-2 py-1.5 outline-none placeholder:text-slate-400 font-medium resize-none max-h-24 custom-scrollbar"
            onInput={(e: any) => {
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending}
            className="bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black px-5 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95 shrink-0"
          >
            {sending ? 'Sending' : 'Send'}
          </button>
        </div>
        <p className="text-slate-300 text-[10px] mt-1.5 pl-1 uppercase tracking-widest font-medium">Shift+Enter for new line</p>
      </div>
    </div>
  );
}
