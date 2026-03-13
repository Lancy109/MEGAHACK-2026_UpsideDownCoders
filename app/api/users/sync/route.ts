import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { id, name, email, phone, role } = await req.json();

    if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

    const user = await prisma.user.upsert({
      where: { id },
      update: {
        name: name || 'Unknown',
        email: email || '',
        phone: phone || 'N/A',
        role: role || 'VOLUNTEER',
      },
      create: {
        id,
        name: name || 'Unknown',
        email: email || '',
        phone: phone || 'N/A',
        role: role || 'VOLUNTEER',
      },
    });

    return NextResponse.json(user);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
