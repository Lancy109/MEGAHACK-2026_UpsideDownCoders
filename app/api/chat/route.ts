import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sosId  = searchParams.get('sosId');
    const cursor = searchParams.get('cursor');
    const limit  = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    if (!sosId) return NextResponse.json({ error: 'sosId is required' }, { status: 400 });

    const messages = await prisma.chatMessage.findMany({
      where:   { sosId },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return NextResponse.json({
      messages,
      hasMore:    messages.length === limit,
      nextCursor: messages.length > 0 ? messages[messages.length - 1].id : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { sosId, senderId, senderName, senderRole, message, messageType = 'TEXT' } = await req.json();
    
    // DEBUG LOGS
    const models = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$'));
    console.log('[API Chat] Available Prisma models:', models);
    if (!prisma.chatMessage) {
      console.error('[API Chat] chatMessage model is MISSING from Prisma client!');
      // Check if it's under ChatMessage (PascalCase) just in case
      if ((prisma as any).ChatMessage) {
        console.log('[API Chat] Found ChatMessage (PascalCase) instead of chatMessage!');
      }
    }

    console.log(`[API Chat] Creating message for SOS ${sosId} from ${senderName}`);

    const msg = await prisma.chatMessage.create({
      data: {
        sosId,
        senderId,
        senderName,
        senderRole,
        message: message.trim(),
        messageType,
        readBy: [senderId],
      },
    });
    
    console.log(`[API Chat] Message created: ${msg.id}`);

    // Broadcast via Socket.io to all room members instantly
    if ((global as any)._io) {
      console.log(`[API Chat] Broadcasting via Socket.io to room chat_${sosId}`);
      (global as any)._io.to(`chat_${sosId}`).emit('chat_message', msg);
    } else {
      console.warn('[API Chat] Socket.io (_io) NOT found on global object');
    }

    return NextResponse.json(msg, { status: 201 });
  } catch (err: any) {
    console.error('[API Chat] POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
