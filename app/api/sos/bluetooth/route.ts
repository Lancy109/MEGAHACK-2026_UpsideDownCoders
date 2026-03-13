import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { emitNewSOS } from '@/lib/socket';

export async function POST(req: Request) {
  try {
    const { packet, deviceId, accept } = await req.json();
    if (!packet || !packet.lat || !packet.lng || !packet.type) {
      return NextResponse.json({ error: 'Invalid packet' }, { status: 400 });
    }

    // Find or create an anonymous user for BLE relay
    const bleUserId = `ble_${packet.originDeviceId || deviceId || 'unknown'}`;
    await prisma.user.upsert({
      where: { id: bleUserId },
      update: {},
      create: {
        id: bleUserId,
        name: `BLE Relay (${packet.originDeviceId?.slice(-6) || 'UNK'})`,
        email: `${bleUserId}@ble.resqnet`,
        phone: 'N/A',
        role: 'VICTIM',
      },
    });

    // Upsert SOS — avoid duplicate BLE packets by checking within 60s window
    const recentCutoff = new Date(Date.now() - 60_000);
    const existing = await prisma.sosAlert.findFirst({
      where: {
        userId: bleUserId,
        lat: { gte: packet.lat - 0.001, lte: packet.lat + 0.001 },
        lng: { gte: packet.lng - 0.001, lte: packet.lng + 0.001 },
        createdAt: { gte: recentCutoff },
      },
    });

    if (existing) {
      // Update relay count if higher
      if (packet.relayCount > existing.relayCount) {
        await prisma.sosAlert.update({
          where: { id: existing.id },
          data: { relayCount: packet.relayCount },
        });
      }
      return NextResponse.json({ id: existing.id, duplicate: true });
    }

    const sos = await prisma.sosAlert.create({
      data: {
        userId: bleUserId,
        type: packet.type,
        description: `BLE SOS received via mesh relay (${packet.relayCount} hops)`,
        lat: packet.lat,
        lng: packet.lng,
        source: 'BLUETOOTH',
        relayCount: packet.relayCount,
      },
      include: { user: { select: { name: true, phone: true } } },
    });

    emitNewSOS(sos);
    return NextResponse.json(sos, { status: 201 });
  } catch (err: any) {
    console.error('[BLE API]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
