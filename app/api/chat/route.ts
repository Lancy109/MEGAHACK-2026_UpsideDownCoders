import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sosId = searchParams.get('sosId');
    if (!sosId) return NextResponse.json({ error: 'Missing sosId' }, { status: 400 });
    
    const messages = await prisma.chatMessage.findMany({
      where: { sosId },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(messages);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { sosId, senderId, senderName, senderRole, message } = await req.json();
    const msg = await prisma.chatMessage.create({
      data: { sosId, senderId, senderName, senderRole, message },
    });
    
    // Emit to all in this SOS room if global._io exists
    // Note: Room management will be handled in the server initialization
    if ((global as any)._io) {
      (global as any)._io.to(`sos-${sosId}`).emit('new_message', msg);
    }
    
    return NextResponse.json(msg, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
