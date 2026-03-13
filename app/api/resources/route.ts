import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { emitToAll } from '@/lib/socket';

export async function GET() {
  try {
    const resources = await prisma.resource.findMany({ orderBy: { category: 'asc' } });
    return NextResponse.json(resources);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const resource = await prisma.resource.create({ data });
    return NextResponse.json(resource, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, quantity } = await req.json();
    const resource = await prisma.resource.update({
      where: { id },
      data: { quantity },
    });
    
    // Emit low stock alert if quantity below threshold
    if (quantity < 10) {
      emitToAll('low_stock_alert', { resource });
    }
    
    return NextResponse.json(resource);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
