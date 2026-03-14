import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { emitTaskUpdate, emitSOSResolved } from '@/lib/socket';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const volunteerId = searchParams.get('volunteerId');
    if (!volunteerId) return NextResponse.json({ error: 'Volunteer ID required' }, { status: 400 });

    const tasks = await prisma.task.findMany({
      where: { volunteerId, status: { not: 'COMPLETED' } },
      include: { sos: { include: { user: { select: { name: true, phone: true } } } } },
    });
    return NextResponse.json(tasks);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { sosId, volunteerId } = await req.json();
    const sos = await prisma.sosAlert.findUnique({
      where: { id: sosId },
      include: { user: true },
    });
    if (!sos) return NextResponse.json({ error: 'SOS not found' }, { status: 404 });
    if (sos.status !== 'ACTIVE')
      return NextResponse.json({ error: 'SOS already assigned' }, { status: 409 });

    // Look up volunteer name
    const volunteer = await prisma.user.findUnique({ where: { id: volunteerId } });
    const volunteerName = volunteer?.name || 'A volunteer';

    const [task] = await prisma.$transaction([
      prisma.task.create({ data: { sosId, volunteerId } }),
      prisma.sosAlert.update({ where: { id: sosId }, data: { status: 'ASSIGNED' } }),
    ]);
    emitTaskUpdate({ sosId, status: 'ASSIGNED', volunteerId, taskId: task.id });

    // Auto-log event to incident timeline
    await prisma.sosEvent.create({
      data: { sosId, event: 'MISSION_ACCEPTED', actor: volunteerId, actorName: volunteerName },
    });

    // Send SYSTEM message to the chat room
    const systemMsg = await prisma.chatMessage.create({
      data: {
        sosId,
        senderId: 'system',
        senderName: 'ResQNet',
        senderRole: 'SYSTEM',
        message: `${volunteerName} has accepted your SOS and is on the way. Stay safe!`,
        messageType: 'SYSTEM',
      },
    });
    const io = (global as any)._io;
    if (io) {
      io.to(`chat_${sosId}`).emit('chat_message', systemMsg);
      io.emit('sos_event', { sosId, event: 'MISSION_ACCEPTED', actorName: volunteerName });
    }

    return NextResponse.json(task, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { taskId } = await req.json();
    const taskToUpdate = await prisma.task.findUnique({ where: { id: taskId } });
    if (!taskToUpdate) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const [task] = await prisma.$transaction([
      prisma.task.update({ where: { id: taskId }, data: { status: 'COMPLETED', completedAt: new Date() } }),
      prisma.sosAlert.update({ where: { id: taskToUpdate.sosId }, data: { status: 'RESOLVED' } }),
    ]);
    emitSOSResolved(task.sosId);
    return NextResponse.json(task);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
