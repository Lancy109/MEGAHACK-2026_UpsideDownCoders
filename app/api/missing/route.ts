import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const persons = await prisma.missingPerson.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(persons);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, age, lastSeen, description, photoUrl, reporterId } = await req.json();
    if (!name || !lastSeen || !reporterId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const person = await prisma.missingPerson.create({
      data: { 
        name, 
        age: age ? parseInt(age) : null, 
        lastSeen, 
        description, 
        photoUrl: photoUrl || null, 
        reporterId 
      },
    });

    const io = (global as any)._io;
    if (io) io.emit('missing_person', person);

    return NextResponse.json(person, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, foundBy } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const person = await prisma.missingPerson.update({
      where: { id },
      data: { status: 'FOUND', foundBy: foundBy || 'volunteer' },
    });

    const io = (global as any)._io;
    if (io) io.emit('person_found', person);

    return NextResponse.json(person);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
