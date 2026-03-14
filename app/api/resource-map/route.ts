import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const resources = await prisma.mapResource.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(resources);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { type, lat, lng, capacity, notes, reporterId } = await req.json();
    if (!type || !lat || !lng || !reporterId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const resource = await prisma.mapResource.create({
      data: { type, lat, lng, capacity: capacity || 0, notes, reporterId },
    });

    // Broadcast to all connected clients
    const io = (global as any)._io;
    if (io) io.emit('resource_added', resource);

    return NextResponse.json(resource, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await prisma.mapResource.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
