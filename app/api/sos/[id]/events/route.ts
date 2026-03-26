import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const events = await prisma.sosEvent.findMany({
      where: { sosId: id },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(events);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { event, actor, actorName, metadata } = await req.json();
    if (!event) return NextResponse.json({ error: 'Event type required' }, { status: 400 });

    const sosEvent = await prisma.sosEvent.create({
      data: {
        sosId: id,
        event,
        actor: actor || 'system',
        actorName: actorName || 'System',
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    // Broadcast to SOS room and NGO dashboard
    const io = (global as any)._io;
    if (io) {
      io.to(`sos-${id}`).emit('sos_event', sosEvent);
      io.emit('sos_event', sosEvent); // also broadcast globally for NGO dashboard
    }

    return NextResponse.json(sosEvent, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
