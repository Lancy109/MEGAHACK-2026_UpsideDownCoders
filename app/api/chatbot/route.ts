import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { messages, emergencyType, language, userLocation } = await req.json();

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const systemContext = `You are an emergency response AI assistant helping a disaster victim.
Current emergency type: ${emergencyType || 'RESCUE'}.
Respond ONLY in ${language || 'English'}.
Location: ${userLocation ? `${userLocation.lat}, ${userLocation.lng}` : 'Unknown'}.
Keep responses SHORT (under 60 words), CALM, and ACTIONABLE.
Focus on: immediate safety, first aid, signaling for help, conserving resources.
Never say you cannot help. Always give practical steps.`;

    const chat = model.startChat({
      history: messages.slice(0, -1).map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: 200, temperature: 0.4 },
    });

    // Add system instruction effectively
    const lastMessage = messages[messages.length - 1].content;
    const prompt = `${systemContext}\n\nUser Question: ${lastMessage}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return NextResponse.json({ reply: response.text() });
  } catch (err) {
    console.error('Chatbot error:', err);
    return NextResponse.json({ reply: 'Stay calm. Move to high ground. Signal for help with anything bright. Conserve your battery.' });
  }
}
