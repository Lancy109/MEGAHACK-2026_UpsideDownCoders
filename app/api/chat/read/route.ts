import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function PATCH(req: Request) {
  try {
    const { sosId, userId } = await req.json();
    if (!sosId || !userId) {
      return NextResponse.json({ error: 'sosId and userId required' }, { status: 400 });
    }

    // Mark all unread messages as read — only updates messages not already including this userId
    // Note: Prisma doesn't support array contains filter for updating, so we fetch then update
    const messages = await prisma.chatMessage.findMany({
      where: { sosId },
      select: { id: true, readBy: true },
    });

    const toUpdate = messages
      .filter((m: { id: string; readBy: string[] }) => !m.readBy.includes(userId))
      .map((m: { id: string; readBy: string[] }) => m.id);

    if (toUpdate.length > 0) {
      try {
        await Promise.all(
          toUpdate.map((id: string) =>
            prisma.chatMessage.update({
              where: { id },
              data: { readBy: { push: userId } },
            })
          )
        );
      } catch (e: any) {
        console.warn('[API Chat Read] Could not update readBy, Prisma client may be outdated:', e.message);
      }
    }

    return NextResponse.json({ success: true, updatedCount: toUpdate.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
