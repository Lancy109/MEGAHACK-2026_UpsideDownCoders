import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// POST /api/notify/broadcast  — send broadcast message
export async function POST(req: Request) {
  try {
    const { message, target } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    let users: any[] = [];

    if (target === 'VOLUNTEERS') {
      users = await prisma.user.findMany({ where: { role: 'VOLUNTEER' } });
    } else if (target === 'VICTIMS') {
      // victims with active SOS
      const activeSOS = await prisma.sosAlert.findMany({
        where: { status: { in: ['ACTIVE', 'ASSIGNED'] } },
        include: { user: { select: { id: true, name: true, phone: true } } },
      });
      users = activeSOS.map((s: { user: any }) => s.user);
    } else {
      users = await prisma.user.findMany();
    }

    // In production, call Twilio here. For demo, just return the user count.
    const sentCount = users.length;

    // If Twilio is configured, send actual SMS
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE) {
      const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      for (const user of users as { phone?: string }[]) {
        if (user.phone && user.phone !== 'N/A' && user.phone !== 'No phone provided') {
          try {
            await twilio.messages.create({
              body: `[ResQNet Broadcast] ${message}`,
              from: process.env.TWILIO_PHONE,
              to: user.phone,
            });
          } catch { /* ignore individual failures */ }
        }
      }
    }

    // Emit socket event for real-time UI notification
    const io = (global as any)._io;
    if (io) {
      if (target === 'VOLUNTEERS') {
        io.emit('broadcast_receive', { message, target, timestamp: Date.now() });
      } else if (target === 'VICTIMS') {
        io.emit('broadcast_receive', { message, target, timestamp: Date.now() });
      } else {
        io.emit('broadcast_receive', { message, target: 'ALL', timestamp: Date.now() });
      }
    }

    return NextResponse.json({ success: true, sentCount, message });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
