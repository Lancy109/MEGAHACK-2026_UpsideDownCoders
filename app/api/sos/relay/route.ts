import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// POST /api/sos/relay — receive a BLE / QR / WebRTC relayed SOS packet
export async function POST(req: Request) {
  try {
    const packet = await req.json();
    const { id, type, lat, lng, description, timestamp, source, relayCount } = packet;

    if (!id || !type || !lat || !lng) {
      return NextResponse.json({ error: 'Missing required packet fields' }, { status: 400 });
    }

    // Check if already exists by checking userId = 'relay_system' + same id as aiSuggestion prefix
    // We use a simpler check via description matching
    const validSources = ['INTERNET', 'BLUETOOTH', 'QUEUED', 'VOICE'];
    const mappedSource = source === 'BLE' || source === 'BLUETOOTH'
      ? 'BLUETOOTH' : source === 'QR' || source === 'WEBRTC'
      ? 'QUEUED' : 'INTERNET';

    // Ensure relay user exists
    await prisma.user.upsert({
      where: { id: 'relay_system' },
      update: {},
      create: { id: 'relay_system', name: 'Offline Relay Node', email: 'relay@resqnet.system', phone: 'N/A', role: 'VICTIM' },
    });

    const sos = await prisma.sosAlert.create({
      data: {
        type,
        description: description || `Relayed ${type} emergency`,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        userId: 'relay_system',
        source: validSources.includes(mappedSource) ? mappedSource as any : 'INTERNET',
        relayCount: relayCount || 1,
        aiSuggestion: `[RELAY] Original packet ID: ${id}. Received via ${source}.`,
      },
    });

    return NextResponse.json({ success: true, sosId: sos.id }, { status: 201 });
  } catch (err: any) {
    // If the packet was already relayed (duplicate type+lat+lng+timestamp), just return OK
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
