import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { clerkClient } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clerkId, name, email, phone, role } = body;

    if (!clerkId || !name || !email || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Create or Update the user in Prisma (idempotent)
    const user = await prisma.user.upsert({
      where: { email },
      update: { role, name, phone, id: clerkId },
      create: {
        id: clerkId,
        name,
        email,
        phone,
        role,
      },
    });

    // 2. Update Clerk publicMetadata so the proxy/middleware knows they are onboarded
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(clerkId, {
      publicMetadata: {
        role: user.role,
        dbId: user.id,
      },
    });

    return NextResponse.json(user);
  } catch (error: any) {
    console.error('User creation/update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    
    const where = role ? { role: role as any } : {};
    
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
      }
    });
    
    return NextResponse.json(users);
  } catch (err: any) {
    console.error('Fetch users error:', err);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
