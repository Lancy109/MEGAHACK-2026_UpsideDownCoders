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
      return "No significant disaster activity reported. All systems operational.";
    }

    const summary = sosData
      .map((s) => `[${s.type}] ${s.description} at ${s.lat},${s.lng}`)
      .join('\n');
      
    const prompt = `System Data (SOS Alerts):\n${summary}\n\nTask: As a Lead Disaster Response Analyst, provide a high-level Strategic Briefing:
1) SITUATIONAL ASSESSMENT: Summarize current crisis clusters and density.
2) RESOURCE ALLOCATION: Suggest where to deploy food vs medical units based on the data.
3) OPERATIONAL RISK: Identify the most critical zones requiring immediate heavy rescue.
4) 24-HOUR OUTLOOK: General recommendations for NGO field teams.
Keep it professional and under 250 words.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
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
