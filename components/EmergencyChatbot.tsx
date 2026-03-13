'use client';
import { useState, useRef, useEffect } from 'react';

const QUICK_QUESTIONS = [
  'What should I do right now?',
  'How do I signal for help?',
  'How do I treat a wound?',
  'Water is rising — what do I do?',
  'Someone is unconscious',
  'How long until help arrives?',
];

export interface EmergencyChatbotProps {
  emergencyType: string;
  language: string;
  userLocation: { lat: number; lng: number } | null;
}

export default function EmergencyChatbot({ emergencyType, language, userLocation }: EmergencyChatbotProps) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: language === 'हिंदी'
        ? 'नमस्ते! मैं आपका आपातकालीन सहायक हूं। मुझसे कोई भी सवाल पूछें।'
        : language === 'मराठी'
        ? 'नमस्कार! मी तुमचा आपत्कालीन सहाय्यक आहे. कोणताही प्रश्न विचारा.'
        : 'Hello! I am your emergency AI assistant. Ask me anything about your situation.',
    }
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text?: string) {
    const userMsg = text || input.trim();
    if (!userMsg) return;
    setInput('');
    setLoading(true);

    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          emergencyType,
          language,
          userLocation,
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I am having trouble connecting. Please stay calm and follow basic safety rules: move to high ground, stay visible, conserve phone battery.',
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl mt-6 flex flex-col shadow-2xl overflow-hidden" style={{ height: '450px' }}>
      <div className="px-5 py-4 bg-slate-800/50 backdrop-blur-md border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-blue-500/10 flex items-center justify-center border border-blue-500/30">
            <span className="text-blue-400 text-[10px] font-black tracking-widest uppercase">SYS</span>
          </div>
          <div>
            <p className="text-white text-sm font-black tracking-tighter">AI RESCUE ADVISOR</p>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] leading-none">Powered by GROQ LPU</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
           <span className="text-slate-500 text-[10px] font-black font-mono px-2 py-0.5 border-l-2 border-blue-500/50 uppercase tracking-widest">{language} active</span>
        </div>
      </div>

      {/* Quick questions */}
      <div className="px-4 py-3 border-b border-black/20 flex gap-2 overflow-x-auto no-scrollbar">
        {QUICK_QUESTIONS.map(q => (
          <button key={q} onClick={() => sendMessage(q)}
            className="flex-shrink-0 text-[10px] font-black uppercase tracking-widest bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-full border border-slate-700 transition-all active:scale-95">
            {q}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-lg text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-none font-medium border border-blue-500'
                : 'bg-slate-800 text-slate-300 rounded-bl-none border-l-2 border-slate-600 shadow-sm font-medium'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800/50 rounded-2xl rounded-bl-none px-4 py-3 border border-white/5">
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 bg-slate-800 border-t border-slate-700 flex gap-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && sendMessage()}
          placeholder="Awaiting command..."
          className="flex-1 bg-black/50 border border-slate-600 text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-500 font-mono"
        />
        <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black px-6 py-3 rounded-lg text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-blue-500/20">
          UPLINK
        </button>
      </div>
    </div>
  );
}
