import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const alerts = await prisma.disasterAlert.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(alerts);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { message, severity, area, createdBy } = await req.json();
    if (!message || !createdBy) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const alert = await prisma.disasterAlert.create({
      data: { message, severity: severity || 'MEDIUM', area, createdBy },
    });

    // Priority broadcast to ALL connected clients
    const io = (global as any)._io;
    if (io) io.emit('disaster_alert', alert);

    return NextResponse.json(alert, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const alert = await prisma.disasterAlert.update({ where: { id }, data: { isActive: false } });
    const io = (global as any)._io;
    if (io) io.emit('alert_dismissed', { id });
    return NextResponse.json(alert);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
