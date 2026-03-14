import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const sosId  = searchParams.get('sosId');

    if (!userId || !sosId) {
      return NextResponse.json({ error: 'userId and sosId required' }, { status: 400 });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sosId },
      select: { readBy: true },
    });

    const count = messages.filter((m: { readBy: string[] }) => !m.readBy.includes(userId)).length;

    return NextResponse.json({ count });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
