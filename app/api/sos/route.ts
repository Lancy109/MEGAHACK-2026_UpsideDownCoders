import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/db';
import { getAISuggestion } from '@/lib/ai';
import { emitNewSOS } from '@/lib/socket';

export async function POST(req: Request) {
  try {
    const { type, description, lat, lng, language, source, isVoiceSOS } = await req.json();
    if (!type || !description || !lat || !lng) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await prisma.user.upsert({
      where: { id: clerkUser.id },
      update: {},
      create: {
        id: clerkUser.id,
        name: `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || 'Anonymous',
        email: clerkUser.emailAddresses[0]?.emailAddress ?? '',
        phone: clerkUser.phoneNumbers.find(p => p.phoneNumber)?.phoneNumber ?? 'No phone provided',
        role: (clerkUser.publicMetadata?.role as any) ?? 'VICTIM',
      },
    });

    const aiSuggestion = await getAISuggestion(type, description, language || 'English');

    const validSources = ['INTERNET', 'BLUETOOTH', 'QUEUED', 'VOICE'];
    const sos = await prisma.sosAlert.create({
      data: {
        type,
        description,
        lat,
        lng,
        userId: clerkUser.id,
        aiSuggestion,
        source: validSources.includes(source) ? source : 'INTERNET',
        isVoiceSOS: isVoiceSOS === true,
      },
      include: { user: { select: { name: true, phone: true } } },
    });

    emitNewSOS(sos);
    return NextResponse.json(sos, { status: 201 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get('all');
    const where = all ? {} : { status: { in: ['ACTIVE', 'ASSIGNED'] } as any };
    const alerts = await prisma.sosAlert.findMany({
      where,
      include: {
        user: { select: { name: true, phone: true } },
        tasks: { include: { volunteer: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(alerts);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
