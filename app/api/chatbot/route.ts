import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama-3.3-70b-versatile';

export async function POST(req: Request) {
  try {
    const { messages, emergencyType, language, userLocation } = await req.json();

    const systemContext = `You are an emergency response AI assistant helping a disaster victim.
Current emergency type: ${emergencyType || 'RESCUE'}.
Respond ONLY in ${language || 'English'}.
Location: ${userLocation ? `${userLocation.lat}, ${userLocation.lng}` : 'Unknown'}.
Keep responses SHORT (under 60 words), CALM, and ACTIONABLE.
Focus on: immediate safety, first aid, signaling for help, conserving resources.
Never say you cannot help. Always give practical steps. Always directly answer the specific question the user asks.`;

    const formattedMessages = [
      { role: 'system', content: systemContext },
      ...messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages: formattedMessages,
      model: MODEL,
      temperature: 0.4,
      max_tokens: 200,
    });

    const reply = chatCompletion.choices[0]?.message?.content || "I am here to help. Please tell me your situation.";
    return NextResponse.json({ reply });
  } catch (err) {
    console.error('Chatbot error:', err);
    return NextResponse.json({ reply: 'Stay calm. Move to high ground. Signal for help with anything bright. Conserve your battery.' });
  }
}
