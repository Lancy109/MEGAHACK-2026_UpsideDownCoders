import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Resolved tasks for avg response time
    const resolvedTasks = await prisma.task.findMany({
      where: { status: 'COMPLETED' },
      include: { sos: { select: { createdAt: true } } },
      take: 200,
      orderBy: { acceptedAt: 'desc' },
    });

    let totalMins = 0, count = 0;
    for (const t of resolvedTasks) {
      if (t.sos?.createdAt && t.acceptedAt) {
        const diff = (t.acceptedAt.getTime() - t.sos.createdAt.getTime()) / 60000;
        if (diff > 0 && diff < 120) { totalMins += diff; count++; }
      }
    }
    const avgResponseTime = count > 0 ? Math.round(totalMins / count) : 0;

    const todayAlerts = await prisma.sosAlert.count({ where: { createdAt: { gte: todayStart } } });

    const allAlerts = await prisma.sosAlert.findMany({
      select: { status: true, lat: true, lng: true, type: true, createdAt: true },
    });

    const active = allAlerts.filter((s: { status: string }) => s.status === 'ACTIVE' || s.status === 'ASSIGNED').length;
    const resolved = allAlerts.filter((s: { status: string }) => s.status === 'RESOLVED').length;
    const total = allAlerts.length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    // Alerts per hour last 24h
    const alertsPerHour: number[] = new Array(24).fill(0);
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    for (const a of allAlerts) {
      if (a.createdAt >= cutoff24h) {
        const hoursAgo = Math.floor((now.getTime() - a.createdAt.getTime()) / (60 * 60 * 1000));
        if (hoursAgo >= 0 && hoursAgo < 24) alertsPerHour[23 - hoursAgo]++;
      }
    }

    // Hotspot zones
    const zones: Record<string, any> = {};
    for (const s of allAlerts) {
      const latGrid = Math.floor(s.lat * 10) / 10;
      const lngGrid = Math.floor(s.lng * 10) / 10;
      const key = `${latGrid},${lngGrid}`;
      if (!zones[key]) zones[key] = { lat: latGrid, lng: lngGrid, count: 0, types: {} };
      zones[key].count++;
      zones[key].types[s.type] = (zones[key].types[s.type] || 0) + 1;
    }
    const hotspots = Object.values(zones).sort((a: any, b: any) => b.count - a.count).slice(0, 5);

    return NextResponse.json({
      avgResponseTime, todayAlerts, active, resolved, resolutionRate,
      alertsPerHour, total, hotspots,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
