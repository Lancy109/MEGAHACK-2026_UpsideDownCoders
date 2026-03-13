import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// PATCH /api/sos/[id]/note  — save an internal NGO note on an SOS alert
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { note, flagged } = await req.json();

    const data: any = {};
    if (note !== undefined) data.aiSuggestion = `${note}`; // store in aiSuggestion column as NGO note prefix
    if (flagged !== undefined) data.isVoiceSOS = flagged; // reuse existing bool as flagged proxy

    const sos = await prisma.sosAlert.update({ where: { id }, data });
    return NextResponse.json(sos);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
