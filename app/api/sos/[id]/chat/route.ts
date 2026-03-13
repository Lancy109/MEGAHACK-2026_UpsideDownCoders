import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

const PAGE_SIZE = 25;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const page  = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || String(PAGE_SIZE), 10);
    const skip  = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { sosId: params.id },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.chatMessage.count({ where: { sosId: params.id } }),
    ]);

    return NextResponse.json({
      messages,
      total,
      page,
      hasMore: skip + messages.length < total,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { senderId, senderName, senderRole, message, messageType = 'TEXT' } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

    const msg = await prisma.chatMessage.create({
      data: {
        sosId: params.id,
        senderId,
        senderName,
        senderRole,
        message: message.trim(),
        messageType,
      },
    });

    // Emit to per-SOS chat room
    const io = (global as any)._io;
    if (io) {
      io.to(`chat_${params.id}`).emit('chat_message', msg);
    }

    return NextResponse.json(msg, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
