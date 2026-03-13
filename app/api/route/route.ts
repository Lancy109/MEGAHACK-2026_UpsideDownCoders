import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { origin, destination } = await req.json();

    if (!origin || !destination || typeof origin.lat !== 'number' || typeof origin.lng !== 'number' || typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
      return NextResponse.json({ error: 'Origin and destination coordinates required' }, { status: 400 });
    }

    // Direct Haversine Fallback function
    function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    try {
      // OSRM coordinates are formatted as {longitude},{latitude}
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;
      
      const res = await fetch(osrmUrl, { 
        headers: { 'User-Agent': 'ResQNet-Hackathon-App' },
        signal: AbortSignal.timeout(3000) // 3 second timeout so UI doesn't hang
      });
      if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
      const data = await res.json();

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = (route.distance / 1000).toFixed(1) + ' km';
        const durationMinutes = Math.round(route.duration / 60);
        const durationStr = durationMinutes > 60 
          ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
          : `${durationMinutes} mins`;

        return NextResponse.json({
          distance: distanceKm,
          duration: durationStr,
          durationValue: route.duration,
          summary: 'Optimal (OSRM)'
        });
      }
    } catch (apiErr) {
      console.warn('OSRM routing blocked or failed, using GPS fallback.', apiErr);
    }

    // FALLBACK IF OSRM FAILS OR BLOCKS US
    const dist = getDistanceInKm(origin.lat, origin.lng, destination.lat, destination.lng);
    const distStr = dist.toFixed(1) + ' km';
    // Assume 30 km/h average local residential speed = 0.5 km/min
    const mins = Math.max(1, Math.round(dist / 0.5));
    const durationStr = mins > 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins} mins`;

    return NextResponse.json({
      distance: distStr,
      duration: durationStr,
      durationValue: mins * 60,
      summary: 'Direct Line (Fallback)'
    });

  } catch (err: any) {
    console.error('Route API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
