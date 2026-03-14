import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// POST /api/notify/broadcast  — send broadcast message
export async function POST(req: Request) {
  try {
    const { message, target, alertIds } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    let users: any[] = [];

    console.log(`[Broadcast API] Intent: target=${target}, alertIds_count=${alertIds?.length || 0}`);

    if (target === 'VOLUNTEERS') {
      users = await prisma.user.findMany({ where: { role: 'VOLUNTEER' } });
    } else if (target === 'VICTIMS_ALL') {
      // All users registered as victims
      users = await prisma.user.findMany({ where: { role: 'VICTIM' } });
    } else if (target === 'VICTIMS' || target === 'VICTIMS_ACTIVE') {
      // only victims with active/assigned SOS
      const activeSOS = await prisma.sosAlert.findMany({
        where: { status: { in: ['ACTIVE', 'ASSIGNED'] } },
        include: { user: { select: { id: true, name: true, phone: true } } },
      });
      users = activeSOS.map((s: { user: any }) => s.user).filter(Boolean);
    } else if (target.startsWith('VICTIMS_') && target !== 'VICTIMS_ALL' && target !== 'VICTIMS_ACTIVE') {
      // victims with active SOS of a specific type (FOOD, MEDICAL, RESCUE)
      const type = target.replace('VICTIMS_', '') as any;
      const activeSOS = await prisma.sosAlert.findMany({
        where: { status: { in: ['ACTIVE', 'ASSIGNED'] }, type: type },
        include: { user: { select: { id: true, name: true, phone: true } } },
      });
      users = activeSOS.map((s: { user: any }) => s.user).filter(Boolean);
    } else if (target === 'SELECTED_ALERTS' && Array.isArray(alertIds) && alertIds.length > 0) {
      const selectedSOS = await prisma.sosAlert.findMany({
        where: { id: { in: alertIds } },
        include: { user: { select: { id: true, name: true, phone: true } } },
      });
      users = selectedSOS.map((s: { user: any }) => s.user).filter(Boolean);
    } else {
      // Default to ALL (Global)
      users = await prisma.user.findMany();
    }

    console.log(`[Broadcast API] Target is ${target}. Fetched users length: ${users?.length}`);

    // DEDUPLICATE USERS (An SOS-based target might find the same user multiple times)
    const uniqueUsersMap = new Map();
    users.forEach(u => {
      if (u && u.id) uniqueUsersMap.set(u.id, u);
    });
    const uniqueUsers = Array.from(uniqueUsersMap.values());
    const sentCount = uniqueUsers.length;

    console.log(`[Broadcast API] Execution: unique_recipients=${sentCount}, Initial array length: ${users.length}, IDs:`, uniqueUsers.map(u=>u.id));
    
    // writing it to a file so agent can read.
    require('fs').appendFileSync('C:\\Users\\parth\\Downloads\\MEGAHACK-2026_UpsideDownCoders-main\\MEGAHACK-2026_UpsideDownCoders-main\\api_debug.log', `[${new Date().toISOString()}] Target=${target}, FetchedUsers=${users?.length}, SentCount=${sentCount}\n`);


    // PERSIST MESSAGE TO DATABASE
    let userIdsStr = null;
    if (target !== 'ALL' && target !== 'GLOBAL') {
      userIdsStr = JSON.stringify(uniqueUsers.map(u => u.id));
    }
    await prisma.broadcastMessage.create({
      data: {
        message,
        target,
        userIds: userIdsStr
      }
    });

    // If Twilio is configured, send actual SMS
    console.log(`[Broadcast API] Notification pipeline start. Twilio configured: ${!!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE)}`);
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE) {
      try {
        const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        for (const user of uniqueUsers as { phone?: string }[]) {
          if (user.phone && user.phone !== 'N/A' && user.phone !== 'No phone provided') {
            try {
              await twilio.messages.create({
                body: `[ResQNet Broadcast] ${message}`,
                from: process.env.TWILIO_PHONE,
                to: user.phone,
              });
            } catch (smsErr) { console.error(`[Broadcast API] Individual SMS fail for ${user.phone}:`, smsErr); }
          }
        }
      } catch (twilioInitErr) {
        console.error('[Broadcast API] Twilio Client Init failed (check credentials):', twilioInitErr);
      }
    }

    // Emit socket event for real-time UI notification
    const io = (global as any)._io;
    console.log(`[Broadcast API] Socket emission. IO exists: ${!!io}`);
    if (io) {
      try {
        const payload = { 
          message, 
          target, 
          timestamp: Date.now(),
          userIds: (target !== 'ALL' && target !== 'GLOBAL') ? uniqueUsers.map(u => u.id) : null
        };
        io.emit('broadcast_receive', payload);
        console.log(`[Broadcast API] Socket emitted successfully to ${uniqueUsers.length} potential users.`);
      } catch (ioErr) {
        console.error('[Broadcast API] Socket emission failed:', ioErr);
      }
    }

    console.log('[Broadcast API] Success. Returning 200.');
    return NextResponse.json({ success: true, sentCount, message });
  } catch (err: any) {
    console.error('[Broadcast API] Fatal Route Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/notify/broadcast — fetch recent broadcast history
export async function GET(req: Request) {
  try {
    // Fetch last 50 broadcasts from the last 48 hours
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const broadcasts = await prisma.broadcastMessage.findMany({
      where: {
        createdAt: { gte: fortyEightHoursAgo }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json({ success: true, broadcasts });
  } catch (err: any) {
    console.error('[Broadcast API] GET Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
