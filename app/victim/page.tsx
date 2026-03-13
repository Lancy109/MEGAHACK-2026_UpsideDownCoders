'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { detectGPS } from '@/utils/gps';
import LiveChat from '@/components/LiveChat';
import EmergencyChatbot from '@/components/EmergencyChatbot';
import NearbyServices from '@/components/NearbyServices';
import VoiceSOS from '@/components/VoiceSOS';
import BluetoothPanel from '@/components/BluetoothPanel';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useSyncEngine } from '@/hooks/useSyncEngine';
import { enqueueSOSPacket } from '@/lib/offlineDB';
import Link from 'next/link';

const LANGUAGES = ['English', 'हिंदी', 'मराठी'];

const TRANSLATIONS: Record<string, any> = {
  English: {
    header: 'Emergency Protocol',
    live: 'Live Link',
    langLabel: 'Preferred Language / भाषा',
    helpLabel: 'What kind of help do you need?',
    food: 'Food & Water',
    medical: 'Medical Help',
    rescue: 'Rescue Me',
    briefLabel: 'Current Situation Brief',
    placeholder: 'E.g. Water level rising fast, 3 people trapped on roof...',
    detecting: 'Acquiring GPS Lock...',
    locked: 'Location Locked',
    gpsError: 'GPS Error. Please allow access.',
    waiting: 'Waiting for GPS...',
    refresh: 'Refresh',
    gpsNote: '※ High-accuracy GPS enabled. Please stay outdoors if possible for best results.',
    broadcast: 'BROADCAST SOS',
    transmitting: 'TRANSMITTING...',
    successTitle: 'SOS Transmitted',
    successMsg: 'Volunteers nearby have been alerted. Help is on the way. Keep your device active for updates.',
    analysisTitle: 'Intelligent Response Analysis',
    protocol: 'Protocol v2.1 Verified',
    another: 'Post Another Request',
    typeError: 'Please select an emergency type.',
    descError: 'Please describe your emergency.',
    gpsRequired: 'GPS location is required. Please allow location access.',
    offlineSuccess: 'You are offline. SOS saved — will auto-send when connection returns.',
    btnSendSOS: 'BROADCAST SOS',
    btnQueue: 'QUEUE OFFLINE',
  },
  हिंदी: {
    header: 'आपातकालीन प्रोटोकॉल',
    live: 'लाइव लिंक',
    langLabel: 'पसंदीदा भाषा',
    helpLabel: 'आपको किस तरह की मदद चाहिए?',
    food: 'भोजन और पानी',
    medical: 'चिकित्सा सहायता',
    rescue: 'मुझे बचाओ',
    briefLabel: 'वर्तमान स्थिति का विवरण',
    placeholder: 'जैसे- पानी का स्तर तेजी से बढ़ रहा है, छत पर 3 लोग फंसे हैं...',
    detecting: 'GPS लोकेशन खोजी जा रही है...',
    locked: 'लोकेशन मिल गई',
    gpsError: 'GPS त्रुटि। कृपया अनुमति दें।',
    waiting: 'GPS की प्रतीक्षा है...',
    refresh: 'रिफ्रेश',
    gpsNote: '※ उच्च-सटीकता GPS सक्रिय। सर्वोत्तम परिणामों के लिए कृपया बाहर रहें।',
    broadcast: 'SOS भेजें',
    transmitting: 'भेजा जा रहा है...',
    successTitle: 'SOS भेज दिया गया',
    successMsg: 'पास के स्वयंसेवकों को सूचित कर दिया गया है। मदद आ रही है। अपडेट के लिए अपने डिवाइस को चालू रखें।',
    analysisTitle: 'इंटेलिजेंट रिस्पांस विश्लेषण',
    protocol: 'प्रोटोकॉल v2.1 सत्यापित',
    another: 'एक और अनुरोध भेजें',
    typeError: 'कृपया आपातकालीन प्रकार चुनें।',
    descError: 'कृपया अपनी स्थिति बताएं।',
    gpsRequired: 'GPS आवश्यक है। कृपया अनुमति दें।',
    offlineSuccess: 'आप ऑफलाइन हैं। SOS सहेज लिया गया है — कनेक्शन वापस आने पर अपने आप भेज दिया जाएगा।',
    btnSendSOS: 'SOS भेजें',
    btnQueue: 'ऑफ़लाइन कतार',
  },
  मराठी: {
    header: 'आणीबाणी प्रोटोकॉल',
    live: 'लाइव्ह लिंक',
    langLabel: 'निवडलेली भाषा',
    helpLabel: 'तुम्हाला कोणत्या प्रकारची मदत हवी आहे?',
    food: 'अन्न आणि पाणी',
    medical: 'वैद्यकीय मदत',
    rescue: 'मला वाचवा',
    briefLabel: 'सध्याच्या परिस्थितीचा तपशील',
    placeholder: 'उदा. पाण्याची पातळी वेगाने वाढत आहे, छतावर ३ लोक अडकले आहेत...',
    detecting: 'GPS लोकेशन शोधत आहे...',
    locked: 'लोकेशन मिळाले',
    gpsError: 'GPS त्रुटी. कृपया परवानगी द्या.',
    waiting: 'GPS ची प्रतीक्षा आहे...',
    refresh: 'रिफ्रेश',
    gpsNote: '※ उच्च-अचूकता GPS सक्रिय. सर्वोत्तम परिणामांसाठी कृपया घराबाहेर राहा.',
    broadcast: 'SOS पाठवा',
    transmitting: 'पाठवत आहे...',
    successTitle: 'SOS पाठवला आहे',
    successMsg: 'जवळपासच्या स्वयंसेवकांना सूचित केले आहे. मदत येत आहे. अपडेटसाठी तुमचे डिव्हाइस चालू ठेवा.',
    analysisTitle: 'इंटेलिजेंट रिस्पॉन्स विश्लेषण',
    protocol: 'प्रोटोकॉल v2.1 सत्यापित',
    another: 'दुसरी विनंती पाठवा',
    typeError: 'कृपया आणीबाणीचा प्रकार निवडा.',
    descError: 'कृपया तुमची परिस्थिती सांगा.',
    gpsRequired: 'GPS आवश्यक आहे. कृपया परवानगी द्या.',
    offlineSuccess: 'तुम्ही ऑफलाइन आहात. SOS सेव्ह केला आहे — कनेक्शन परत आल्यावर आपोआप पाठवला जाईल.',
    btnSendSOS: 'SOS पाठवा',
    btnQueue: 'ऑफलाइन रांग',
  }
};

const SOS_TYPES = [
  { type: 'FOOD',    icon: 'FOD', key: 'food',    color: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-800 hover:border-yellow-400', ring: 'ring-yellow-300', active: 'border-yellow-500 bg-yellow-100' },
  { type: 'MEDICAL', icon: 'MED', key: 'medical', color: 'bg-red-50 hover:bg-red-100 border-red-200 text-red-800 hover:border-red-400',             ring: 'ring-red-300',    active: 'border-red-500 bg-red-100' },
  { type: 'RESCUE',  icon: 'RSC', key: 'rescue',  color: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800 hover:border-blue-400',        ring: 'ring-blue-300',   active: 'border-blue-500 bg-blue-100' },
];

export default function VictimPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { isOnline } = useNetworkStatus();
  const { syncAll } = useSyncEngine();

  useEffect(() => {
    if (isLoaded && user && !user.publicMetadata?.role) {
      router.replace('/user-type');
    }
  }, [isLoaded, user, router]);

  const [language, setLanguage]       = useState('English');
  const [sosType, setSosType]         = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [gps, setGps]                 = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus]     = useState('idle');
  const [loading, setLoading]         = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [submittedSosId, setSubmittedSosId] = useState<string | null>(null);
  const [aiAdvice, setAiAdvice]       = useState('');
  const [error, setError]             = useState('');
  const [offlineSaved, setOfflineSaved] = useState(false);

  const t = TRANSLATIONS[language] || TRANSLATIONS.English;

  useEffect(() => {
    setGpsStatus('detecting');
    detectGPS()
      .then((coords) => { setGps(coords); setGpsStatus('detected'); })
      .catch(() => setGpsStatus('error'));
  }, []);

  function handleVoiceSOSReady({ transcript, type, isVoice }: { transcript: string; type: string; isVoice: boolean }) {
    // Auto-fill the form and immediately submit
    setDescription(transcript);
    setSosType(type);
    // Small delay to let state update, then auto-submit
    setTimeout(() => {
      handleSOSWithData({ description: transcript, sosType: type, isVoice });
    }, 500);
  }

  function handleTranscriptOnly(transcript: string) {
    // Just fill the description field, let user review
    setDescription(transcript);
  }

  async function handleSOS() {
    return handleSOSWithData();
  }

  async function handleSOSWithData(overrides: { description?: string; sosType?: string; isVoice?: boolean; source?: string } = {}) {
    const finalType        = overrides.sosType || sosType;
    const finalDescription = overrides.description || description;
    const isVoiceSOS       = overrides.isVoice || false;
    const currentSource    = overrides.source || (isOnline ? 'INTERNET' : 'QUEUED');

    if (!finalType)            return setError(t.typeError);
    if (!finalDescription.trim()) return setError(t.descError);
    if (!gps)                return setError(t.gpsRequired);

    setError('');
    setLoading(true);

    const sosPayload = {
      type: finalType,
      description: finalDescription,
      lat: gps.lat,
      lng: gps.lng,
      userId: (user?.publicMetadata as any)?.dbId || user?.id,
      language,
      source: currentSource,
      isVoiceSOS,
    };

    try {
      if (!isOnline) {
        const localId = await enqueueSOSPacket(sosPayload);
        setSubmitted(true);
        setOfflineSaved(true);
        setAiAdvice(`You are currently offline. Your SOS has been saved (ID: ${localId.slice(-6).toUpperCase()}) and will be automatically broadcast as soon as your connection is restored. Stay safe!`);
        return;
      }

      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sosPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'SOS failed');
      setAiAdvice(data.aiSuggestion || '');
      setSubmittedSosId(data.id);
      setSubmitted(true);
    } catch (err: any) {
      if (!navigator.onLine) {
        await enqueueSOSPacket(sosPayload);
        setSubmitted(true);
        setOfflineSaved(true);
        setAiAdvice('Offline SOS saved. Will sync automatically when connected.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg text-center bg-white p-10 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center animate-bounce shadow-sm">
               <div className="w-8 h-4 border-b-4 border-l-4 border-emerald-500 -rotate-45 -mt-2" />
            </div>
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">{t.successTitle}</h2>
          <p className="text-slate-500 mb-8 font-medium">{t.successMsg}</p>

          {offlineSaved && (
            <div className="bg-amber-950 border border-amber-700 rounded-2xl p-6 mb-8 text-center shadow-lg">
              <p className="text-amber-400 font-black text-lg mb-1 flex items-center justify-center gap-2">📱 SAVED OFFLINE</p>
              <p className="text-amber-500/80 text-xs font-bold uppercase tracking-wider">Your SOS is queued and will transmit automatically via priority uplink when signal returns.</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                <span className="text-amber-600 text-[10px] font-black uppercase tracking-widest">Waiting for connection...</span>
              </div>
            </div>
          )}

          {aiAdvice && (
            <div className="bg-slate-900 text-white rounded-3xl p-8 text-left mb-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 text-6xl group-hover:scale-110 transition-transform duration-500 font-black tracking-tighter">AI</div>
              <h3 className="text-emerald-400 font-black text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                {t.analysisTitle}
              </h3>
              <div className="prose prose-invert max-w-none text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium">
                {aiAdvice}
              </div>
            </div>
          )}

          {submittedSosId && (
            <div className="mb-8">
              <LiveChat 
                sosId={submittedSosId} 
                currentUserId={(user?.publicMetadata as any)?.dbId || user?.id || ''} 
                currentUserName={user?.fullName || 'Victim'} 
                currentUserRole="VICTIM" 
              />
            </div>
          )}

          <div className="space-y-4">
             <EmergencyChatbot emergencyType={sosType || 'RESCUE'} language={language} userLocation={gps} />
             <NearbyServices lat={gps?.lat} lng={gps?.lng} />
          </div>

          <button
            onClick={() => { setSubmitted(false); setSosType(null); setDescription(''); setOfflineSaved(false); }}
            className="mt-12 text-slate-500 font-bold hover:text-slate-900 transition underline underline-offset-4"
          >
            {t.another}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 lg:py-12">
      <div className="max-w-5xl mx-auto bg-white p-6 lg:p-10 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t.header}</h1>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-[10px] font-black uppercase text-slate-500">{isOnline ? 'Online' : 'Offline'}</span>
             </div>
             <span className="bg-red-50 border border-red-200 text-red-600 text-[10px] uppercase tracking-widest font-black px-3 py-1.5 rounded-full animate-pulse shadow-sm shadow-red-100">
               {t.live}
             </span>
          </div>
        </div>

        {/* PANIC LINK */}
        <Link href="/panic" 
          className="block w-full bg-red-600/5 border border-red-600/20 hover:bg-red-600/10 transition-all rounded-2xl p-4 mb-8 group relative z-10 cursor-pointer">
          <div className="flex items-center justify-between mb-1">
             <span className="text-red-600 font-black text-sm uppercase tracking-tighter">Emergency Panic Button</span>
             <span className="text-red-500 animate-pulse group-hover:translate-x-1 transition-transform">→</span>
          </div>
          <p className="text-red-900/40 text-[10px] font-bold uppercase tracking-widest">Hold to broadcast SOS instantly with zero form filling</p>
        </Link>

        <div className="lg:grid lg:grid-cols-2 lg:gap-10">
          <div>
            {/* LANGUAGE */}
            <div className="mb-8">
          <label className="text-slate-500 font-bold text-xs uppercase tracking-wider block mb-3">{t.langLabel}</label>
          <div className="flex gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`flex-1 py-3 text-sm rounded-lg font-bold transition-all ${
                  language === lang
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* VOICE SOS OPTION */}
        <VoiceSOS 
           language={language}
           onVoiceSOSReady={handleVoiceSOSReady}
           onTranscriptOnly={handleTranscriptOnly}
        />

        <div className="flex items-center gap-4 my-10">
           <div className="flex-1 h-px bg-slate-100" />
           <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Manual Entry Protocol</span>
           <div className="flex-1 h-px bg-slate-100" />
        </div>

        {/* SOS TYPE */}
        <div className="mb-8">
          <label className="text-slate-500 font-bold text-xs uppercase tracking-wider block mb-3">{t.helpLabel}</label>
          <div className="grid grid-cols-3 gap-3">
            {SOS_TYPES.map((st) => (
              <button
                key={st.type}
                onClick={() => setSosType(st.type)}
                className={`py-5 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-2 ${st.color} ${
                  sosType === st.type ? `ring-4 ${st.ring} rotate-1 scale-105 shadow-sm ${st.active}` : 'bg-white opacity-80 hover:opacity-100'
                }`}
              >
                <span className="text-4xl">{st.icon}</span>
                <span className="text-[10px] leading-tight text-center font-black uppercase tracking-tighter">{t[st.key]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* DESCRIPTION */}
        <div className="mb-8">
          <label className="text-slate-500 font-bold text-xs uppercase tracking-wider block mb-3">{t.briefLabel}</label>
          <textarea
            rows={4} value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.placeholder}
            className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100 text-slate-900 rounded-xl px-5 py-4 resize-none outline-none transition-all placeholder:text-slate-400 font-medium text-sm"
          />
        </div>

        {/* GPS */}
        <div className="mb-8 flex flex-col gap-2">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {gpsStatus === 'detecting' && <><span className="w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse shadow-sm shadow-yellow-200" /><span className="text-slate-700 text-sm font-bold">{t.detecting}</span></>}
              {gpsStatus === 'detected'  && <><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-sm shadow-emerald-200" /><span className="text-emerald-700 text-sm font-bold">{t.locked}: {gps?.lat.toFixed(4)}, {gps?.lng.toFixed(4)}</span></>}
              {gpsStatus === 'error'     && <><span className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm shadow-red-200" /><span className="text-red-700 text-sm font-bold">{t.gpsError}</span></>}
              {gpsStatus === 'idle'      && <><span className="w-2.5 h-2.5 bg-slate-300 rounded-full" /><span className="text-slate-500 text-sm font-bold">{t.waiting}</span></>}
            </div>
            
            <button 
              onClick={() => {
                setGpsStatus('detecting');
                detectGPS()
                  .then((coords) => { setGps(coords); setGpsStatus('detected'); })
                  .catch(() => setGpsStatus('error'));
              }}
              className="text-blue-600 font-bold text-xs uppercase hover:underline"
            >
               {t.refresh}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 font-medium px-2 italic">{t.gpsNote}</p>
        </div>
      </div>

      <div className="flex flex-col h-full">
        {/* NEARBY SERVICES (Pre-submit advice) */}
        {gpsStatus === 'detected' && <NearbyServices lat={gps?.lat} lng={gps?.lng} />}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-5 py-4 rounded-xl mb-6 flex gap-3">
            <span className="font-black">⚠</span> {error}
          </div>
        )}

        <button
          onClick={handleSOS} disabled={loading}
          className={`sos-pulse w-full disabled:opacity-50 text-white font-black tracking-widest text-lg py-5 rounded-2xl transition-all shadow-2xl active:scale-[0.98] mt-8 ${
            isOnline ? 'bg-red-600 hover:bg-red-700 shadow-red-600/30' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
          }`}
        >
          {loading ? t.transmitting : (isOnline ? t.btnSendSOS : t.btnQueue)}
        </button>

        <div className="mt-8">
           <EmergencyChatbot emergencyType={sosType || 'RESCUE'} language={language} userLocation={gps} />
        </div>
      </div>
    </div>

    <BluetoothPanel onPacketReceived={(p) => {}} />
      </div>
    </div>
  );
}
