import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const allSOS = await prisma.sosAlert.findMany({
      select: { lat: true, lng: true, type: true, status: true, createdAt: true }
    });

    // Group into 0.1 degree grid cells (~11km x 11km)
    const zones: Record<string, any> = {};
    for (const s of allSOS) {
      const latGrid = Math.floor(s.lat * 10) / 10;
      const lngGrid = Math.floor(s.lng * 10) / 10;
      const key = `${latGrid},${lngGrid}`;
      
      if (!zones[key]) {
        zones[key] = { lat: latGrid, lng: lngGrid, count: 0, types: {} };
      }
      zones[key].count++;
      zones[key].types[s.type] = (zones[key].types[s.type] || 0) + 1;
    }

    const hotspots = Object.values(zones)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({ hotspots, totalZones: Object.keys(zones).length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
