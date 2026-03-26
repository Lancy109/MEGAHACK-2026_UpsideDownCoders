'use client';
import { useState, useRef, useEffect } from 'react';

const LANG_CODES: Record<string, string> = {
  'English': 'en-IN',
  'हिंदी':   'hi-IN',
  'मराठी':   'mr-IN',
};

const EMERGENCY_KEYWORDS: Record<string, string[]> = {
  MEDICAL: ['help', 'injured', 'hurt', 'bleeding', 'pain', 'sick', 'unconscious', 'breathe',
            'heart', 'accident', 'medical', 'मदद', 'चोट', 'दर्द', 'मदत', 'जखम'],
  FOOD:    ['food', 'water', 'hungry', 'thirst', 'starving', 'drink', 'eat',
            'भूख', 'पानी', 'खाना', 'पाणी', 'अन्न'],
  RESCUE:  ['flood', 'fire', 'stuck', 'trapped', 'rescue', 'danger', 'sinking', 'roof',
            'बाढ़', 'आग', 'फंसा', 'पूर', 'अडकलो'],
};

function detectEmergencyType(transcript: string) {
  const lower = transcript.toLowerCase();
  for (const [type, keywords] of Object.entries(EMERGENCY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return type;
  }
  return 'RESCUE'; // default
}

export interface VoiceSOSProps {
  language: string;
  onVoiceSOSReady: (data: { transcript: string; type: string; isVoice: boolean }) => void;
  onTranscriptOnly: (transcript: string) => void;
}

export default function VoiceSOS({ language, onVoiceSOSReady, onTranscriptOnly }: VoiceSOSProps) {
  const [state, setState]           = useState('idle');
  // states: idle | requesting | listening | processing | ready | error
  const [transcript, setTranscript] = useState('');
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [aiDescription, setAiDescription] = useState('');
  const [confidence, setConfidence] = useState<'HIGH'|'MEDIUM'|'LOW'|null>(null);
  const [rawConfidenceNum, setRawConfidenceNum] = useState(0);
  const [volume, setVolume]         = useState(0);
  const recognitionRef = useRef<any>(null);
  const animFrameRef   = useRef<number | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);

  // Volume visualizer using Web Audio API
  async function startVolumeVisualizer() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('AudioContext not supported, skipping visualizer.');
        return;
      }
      const audioCtx  = new AudioContextClass();
      const source    = audioCtx.createMediaStreamSource(stream);
      const analyser  = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      function updateVolume() {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVolume(Math.min(100, avg * 2));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      }
      updateVolume();
    } catch (err) {
      console.error('Visualizer error:', err);
    }
  }

  function stopVolumeVisualizer() {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    setVolume(0);
  }

  function startListening() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech Recognition API not supported in this browser.');
      setState('error');
      return;
    }

    setState('requesting');
    const recognition = new SpeechRecognition();

    recognition.lang          = LANG_CODES[language] || 'en-IN';
    recognition.continuous    = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setState('listening');
      startVolumeVisualizer();
    };

    recognition.onresult = (e: any) => {
      let interim  = '';
      let final    = '';
      let maxConf  = 0;

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          final   += result[0].transcript;
          maxConf = Math.max(maxConf, result[0].confidence);
        } else {
          interim += result[0].transcript;
        }
      }

      const current = final || interim;
      setTranscript(current);
      if (final) {
        setRawConfidenceNum(Math.round(maxConf * 100));
        const type = detectEmergencyType(final);
        setDetectedType(type);
        setState('processing');
        stopVolumeVisualizer();
      }
    };

    recognition.onerror = (e: any) => {
      console.warn('Speech error:', e.error);
      if (e.error === 'no-speech') {
        setState('idle');
        stopVolumeVisualizer();
        return;
      }
      setState('error');
      stopVolumeVisualizer();
    };

    recognition.onend = () => {
      stopVolumeVisualizer();
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    stopVolumeVisualizer();
  }

  // Called from onend with final transcript — run AI analysis
  useEffect(() => {
    if (state !== 'processing' || !transcript) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ai?action=voice&lang=${encodeURIComponent(language)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setDetectedType(data.type || detectedType);
          setAiDescription(data.description || transcript);
          setConfidence(data.confidence || 'LOW');
        } else {
          setAiDescription(transcript);
          setConfidence('LOW');
        }
      } catch {
        setAiDescription(transcript);
        setConfidence('LOW');
      }
      if (!cancelled) setState('ready');
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, transcript]);

  function confirmAndCreateSOS() {
    if (onVoiceSOSReady && detectedType) {
      onVoiceSOSReady({ transcript: aiDescription || transcript, type: detectedType, isVoice: true });
    }
    setState('idle');
    setTranscript('');
    setAiDescription('');
    setDetectedType(null);
    setConfidence(null);
  }

  function useAsDescription() {
    if (onTranscriptOnly) onTranscriptOnly(aiDescription || transcript);
    setState('idle');
    setTranscript('');
    setAiDescription('');
  }

  function reset() {
    recognitionRef.current?.stop();
    stopVolumeVisualizer();
    setState('idle');
    setTranscript('');
    setAiDescription('');
    setDetectedType(null);
    setConfidence(null);
  }

  const typeColors: Record<string, string> = {
    MEDICAL: 'bg-red-900/50 border-red-600/50 text-red-200',
    FOOD:    'bg-yellow-900/50 border-yellow-600/50 text-yellow-200',
    RESCUE:  'bg-blue-900/50 border-blue-600/50 text-blue-200',
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mt-6 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-full bg-red-600/20" />
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-600/10 flex items-center justify-center border border-red-600/20 group-hover:scale-110 transition-transform font-black text-red-500">
            SYS
          </div>
          <div>
            <h3 className="text-white font-black text-sm uppercase tracking-tighter">VOICE SOS COMMAND</h3>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-none">High Priority Signal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Awaiting Audio</span>
        </div>
      </div>

      {/* IDLE STATE */}
      {state === 'idle' && (
        <button
          onClick={startListening}
          className="w-full relative group/btn"
        >
          <div className="absolute -inset-1 bg-linear-to-r from-red-600 to-orange-600 rounded-2xl blur opacity-10 group-hover/btn:opacity-25 transition" />
          <div className="relative flex flex-col items-center justify-center gap-4 bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-red-600/50 text-slate-300 hover:text-white font-black py-8 rounded-2xl transition-all active:scale-[0.98]">
            <div className="w-12 h-12 bg-red-600/20 border border-red-500/30 rounded-full flex items-center justify-center animate-bounce shadow-[0_0_15px_rgba(220,38,38,0.5)]">
              <div className="w-4 h-4 rounded-full bg-red-500" />
            </div>
            <div className="text-center">
              <p className="text-lg tracking-tighter leading-tight font-black">TAP TO SPEAK</p>
              <p className="text-[10px] uppercase opacity-50 tracking-widest font-black">Auto-detecting emergency type</p>
            </div>
          </div>
        </button>
      )}

      {/* REQUESTING MIC */}
      {state === 'requesting' && (
        <div className="text-center py-10">
          <div className="inline-block w-8 h-8 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin mb-4" />
          <p className="text-slate-400 font-black text-xs uppercase tracking-widest animate-pulse">Initializing Microphone Hardware...</p>
        </div>
      )}

      {/* LISTENING STATE */}
      {state === 'listening' && (
        <div className="text-center slide-in">
          <div className="flex items-center justify-center gap-1.5 mb-8 h-20">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 bg-red-500 rounded-full transition-all duration-75 relative"
                style={{
                  height: `${Math.max(6, (volume + Math.sin(Date.now() / 200 + i) * 20) * (0.4 + Math.random() * 0.6))}px`,
                  opacity: 0.4 + Math.random() * 0.6,
                }}
              >
                 <div className="absolute inset-0 bg-red-400 blur-[2px] opacity-50" />
              </div>
            ))}
          </div>

          <p className="text-red-500 font-black text-2xl uppercase tracking-tighter animate-pulse mb-1">RECORDING LIVE DATA</p>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-6 italic">Speak clearly in {language} for analysis</p>

          {transcript && (
            <div className="bg-black/40 backdrop-blur-md rounded-2xl px-6 py-5 text-left mb-8 border border-white/5 shadow-inner">
              <p className="text-slate-300 text-sm italic font-medium">"{transcript}"</p>
            </div>
          )}

          <button onClick={stopListening}
            className="group/stop relative inline-flex items-center gap-3 bg-slate-800 hover:bg-white text-white hover:text-black font-black px-10 py-4 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 border border-white/10 shadow-xl">
            <span className="w-3 h-3 bg-red-600 group-hover/stop:scale-125 transition-transform" /> 
            Stop Recording
          </button>
        </div>
      )}

      {/* PROCESSING */}
      {state === 'processing' && (
        <div className="text-center py-12 flex flex-col items-center">
          <div className="relative mb-6 w-16 h-16 flex items-center justify-center">
             <div className="absolute inset-0 bg-red-600 blur-2xl opacity-20 animate-pulse" />
             <div className="w-12 h-12 border-4 border-slate-700 border-t-red-500 rounded-full animate-spin" />
          </div>
          <p className="text-white font-black text-sm uppercase tracking-widest">AI Linguistic Analysis...</p>
          {transcript && <p className="text-slate-500 text-[10px] mt-3 italic font-medium">"{transcript}"</p>}
        </div>
      )}

      {/* READY */}
      {state === 'ready' && transcript && (
        <div className="space-y-4 slide-in">
          <div className="bg-black/30 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-inner">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Transcribed Command:</p>
            <p className="text-white text-base font-black leading-tight italic">"{aiDescription || transcript}"</p>
            {/* Confidence badge */}
            {confidence && (
              <div className="mt-4 flex items-center gap-3">
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                  confidence === 'HIGH'   ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50' :
                  confidence === 'MEDIUM' ? 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/50'   :
                  'bg-red-900/60 text-red-300 border border-red-700/50'
                }`}>{confidence} confidence</span>
                {rawConfidenceNum > 0 && (
                  <div className="flex-1 bg-slate-800 rounded-full h-1 overflow-hidden">
                    <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${rawConfidenceNum}%` }} />
                  </div>
                )}
              </div>
            )}
          </div>

          {detectedType && (
            <div className={`border-2 rounded-2xl px-6 py-5 flex items-center justify-between shadow-xl ${typeColors[detectedType]}`}>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Classified Emergency</p>
                <div className="flex items-center gap-3">
                   <p className="font-black text-3xl tracking-tighter">{detectedType}</p>
                   <span className="text-slate-200/20 text-xs font-black italic tracking-widest">(DETECTED)</span>
                </div>
              </div>
              <span className="text-xs font-black uppercase tracking-widest opacity-40 group-hover:scale-110 transition-transform">
                {detectedType}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <button onClick={confirmAndCreateSOS}
              className="bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-2xl text-xs uppercase tracking-[0.2em] transition-all active:scale-95 shadow-lg shadow-red-900/40">
              SOS BROADCAST
            </button>
            <button onClick={useAsDescription}
              className="bg-slate-800 hover:bg-slate-700 text-white font-black py-5 rounded-2xl text-xs uppercase tracking-[0.2em] transition-all active:scale-95 border border-white/5">
              EDIT INTEL
            </button>
          </div>

          <button onClick={reset} className="w-full text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] hover:text-slate-400 transition-colors py-2 flex items-center justify-center gap-2">
            ↺ RESET COMMAND
          </button>
        </div>
      )}

      {/* ERROR STATE */}
      {state === 'error' && (
        <div className="text-center py-10 flex flex-col items-center">
          <div className="w-16 h-16 border border-red-500/30 bg-red-500/10 rounded-2xl mb-6 flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.5)]">
             <div className="w-6 h-1 bg-red-500 rounded-full rotate-45 absolute" />
             <div className="w-6 h-1 bg-red-500 rounded-full -rotate-45 absolute" />
          </div>
          <p className="text-red-500 font-black text-lg uppercase tracking-tight mb-2">Sensor Link Failed</p>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-8 max-w-[240px] leading-relaxed">
            Microphone hardware is unavailable. VOICE SOS requires Chrome/Safari on HTTPS or Localhost.
          </p>
          <button onClick={reset}
            className="bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest px-8 py-4 rounded-xl border border-white/5 transition-all active:scale-95">
            Retrying Handshake...
          </button>
        </div>
      )}
    </div>
  );
}
