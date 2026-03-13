import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateNGOReport, analyzeVoiceTranscript } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'voice') {
      const { transcript } = await req.json();
      const lang = searchParams.get('lang') || 'English';
      if (!transcript) return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });
      const result = await analyzeVoiceTranscript(transcript, lang);
      return NextResponse.json(result);
    }

    // Default: NGO Report
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeAlerts = await prisma.sosAlert.findMany({
      where: { 
        status: { in: ['ACTIVE', 'ASSIGNED'] },
        createdAt: { gte: sevenDaysAgo }
      },
      select: { type: true, description: true, lat: true, lng: true, status: true, createdAt: true },
    });
    const report = await generateNGOReport(activeAlerts);
    return NextResponse.json({ report, generatedAt: new Date(), totalAlerts: activeAlerts.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
