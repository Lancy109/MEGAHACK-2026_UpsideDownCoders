import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = 'llama-3.3-70b-versatile';

export async function getAISuggestion(type: string, description: string, language = 'English') {
  try {
    const prompt = `You are an emergency response advisor. 
Emergency Type: ${type}. 
Situation: ${description}. 
Respond in ${language}.
Give exactly:
1) IMMEDIATE STEPS: What the victim should do right now (2-3 steps)
2) BRING: What the volunteer must bring
3) URGENCY: One word — LOW, MEDIUM, or CRITICAL
4) FIRST AID: One quick tip
Keep total response under 100 words. Be direct and actionable.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: MODEL,
      temperature: 0.5,
      max_tokens: 256,
    });

    const responseText = chatCompletion.choices[0]?.message?.content;
    if (!responseText) throw new Error('Empty response from Groq');
    return responseText;
  } catch (err) {
    console.error('CRITICAL: Groq API Failure:', err);
    return `IMMEDIATE STEPS: Stay calm and move to a safe, visible location. Signal rescue teams.
BRING: First aid kit, water, and emergency whistle.
URGENCY: MEDIUM (System Fallback)
FIRST AID: Apply pressure to any bleeding. Keep warm.`;
  }
}

export async function analyzeVoiceTranscript(
  transcript: string,
  language = 'English'
): Promise<{ type: string; description: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' }> {
  const fallback = { type: detectTypeFromText(transcript), description: transcript, confidence: 'LOW' as const };
  try {
    const prompt = `You are an emergency response classifier. Analyze this voice transcript and extract:
1) TYPE: One of FOOD, MEDICAL, or RESCUE (based on the emergency described)
2) DESCRIPTION: Clean, concise description of the emergency (max 50 words)
3) CONFIDENCE: HIGH if very clear, MEDIUM if somewhat clear, LOW if ambiguous

Transcript: "${transcript}"
Language: ${language}

Respond in STRICT JSON only, no extra text:
{"type":"MEDICAL","description":"...","confidence":"HIGH"}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: MODEL,
      temperature: 0.1,
      max_tokens: 128,
    });

    const text = chatCompletion.choices[0]?.message?.content?.trim();
    if (!text) return fallback;
    const parsed = JSON.parse(text);
    return {
      type: ['FOOD','MEDICAL','RESCUE'].includes(parsed.type) ? parsed.type : fallback.type,
      description: parsed.description || transcript,
      confidence: ['HIGH','MEDIUM','LOW'].includes(parsed.confidence) ? parsed.confidence : 'LOW',
    };
  } catch (err) {
    console.error('analyzeVoiceTranscript error:', err);
    return fallback;
  }
}

function detectTypeFromText(text: string): string {
  const lower = text.toLowerCase();
  const medicalkw = ['hurt','injured','bleeding','pain','sick','medical','accident','breathe','heart'];
  const foodkw    = ['food','water','hungry','thirst','starving','drink','eat'];
  if (medicalkw.some(k => lower.includes(k))) return 'MEDICAL';
  if (foodkw.some(k => lower.includes(k))) return 'FOOD';
  return 'RESCUE';
}

export async function generateNGOReport(sosData: any[]) {
  try {
    if (!sosData || sosData.length === 0) {
      return "Current Status: NORMAL OPERATIONS. All localized incidents have been resolved. No critical alerts are currently active in the specified region. Monitoring continues.";
    }

    const summary = sosData
      .map((s) => `[${s.type}] ${s.description} at ${s.lat},${s.lng} (Status: ${s.status})`)
      .join('\n');
      
    const prompt = `System Data (SOS Alerts Log):\n${summary}\n\nTask: As a Lead Disaster Response Analyst for NGO Command, provide a high-level Strategic Briefing based on the data above.
Include the following sections precisely:

1) EXECUTIVE SUMMARY: A concise overview of the current crisis status.
2) GEOGRAPHIC HOTSPOTS: Identify clusters and specific zones requiring immediate attention.
3) RESOURCE & UNIT DEPLOYMENT: Recommendations for specialized team (Medical, Food, Rescue) positioning.
4) LOGISTICAL RISKS: Identify potential bottlenecks or high-urgency zones based on alert density.
5) 24-HOUR STRATEGIC OUTLOOK: Forecast and recommended stance for field operatives.

Style: Professional, data-driven, and authoritative. Limit to 250 words total.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'system', content: 'You are a professional emergency response analyst.' }, { role: 'user', content: prompt }],
      model: MODEL,
      temperature: 0.3,
      max_tokens: 1024,
    });

    const responseText = chatCompletion.choices[0]?.message?.content;
    if (!responseText) return 'No summary could be generated at this time.';
    return responseText;
  } catch (err) {
    console.error('Groq NGO Report API Error:', err);
    return 'The AI agent is currently busy. Please try again later.';
  }
}
