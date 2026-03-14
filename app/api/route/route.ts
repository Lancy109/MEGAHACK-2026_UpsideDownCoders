import { NextResponse } from 'next/server';

// In-memory cache for routing results to reduce external API pressure
const routeCache = new Map<string, { data: any, expires: number }>();
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

// Haversine formula for straight-line distance
function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { origin, destination } = body;

    if (!origin || !destination || typeof origin.lat !== 'number' || typeof origin.lng !== 'number' || typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
      return NextResponse.json({ error: 'Origin and destination coordinates required' }, { status: 400 });
    }

    // Bucket coordinates to 3 decimal places for better cache hits (~110m accuracy)
    const cacheKey = `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}|${destination.lat.toFixed(3)},${destination.lng.toFixed(3)}`;
    
    // Check Cache
    const cached = routeCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json({ ...cached.data, cached: true });
    }

    try {
      // OSRM coordinates are formatted as {longitude},{latitude}
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;
      
      let res: Response | undefined;
      let attempt = 0;
      const maxAttempts = 2;
      
      while (attempt < maxAttempts) {
        try {
          res = await fetch(osrmUrl, { 
            headers: { 'User-Agent': 'ResQNet-Hackathon-App' },
            signal: AbortSignal.timeout(attempt === 0 ? 3000 : 2000)
          });
          if (res.ok) break;
        } catch (e) {
          if (attempt === maxAttempts - 1) throw e;
        }
        attempt++;
      }

      if (res && res.ok) {
        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distanceKm = (route.distance / 1000).toFixed(1) + ' km';
          const durationMinutes = Math.round(route.duration / 60);
          const durationStr = durationMinutes > 60 
            ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
            : `${durationMinutes} mins`;

          const result = {
            distance: distanceKm,
            duration: durationStr,
            durationValue: route.duration,
            summary: 'Optimal (OSRM)'
          };

          // Cache the successful result
          routeCache.set(cacheKey, { data: result, expires: Date.now() + CACHE_DURATION });

          return NextResponse.json(result);
        }
      }
    } catch (apiErr) {
      console.warn('OSRM routing blocked or failed, using GPS fallback.', apiErr);
    }

    // FALLBACK IF OSRM FAILS OR BLOCKS US
    const straightLineDist = getDistanceInKm(origin.lat, origin.lng, destination.lat, destination.lng);
    
    // Improved fallback: road buffer factor (~1.35x straight line distance is common for urban routing)
    const roadDist = straightLineDist * 1.35;
    const distStr = roadDist.toFixed(1) + ' km';
    
    // Assume 30 km/h average local residential speed = 0.5 km/min
    const mins = Math.max(1, Math.round(roadDist / 0.5));
    const durationStr = mins > 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins} mins`;

    const fallbackResult = {
      distance: distStr,
      duration: durationStr,
      durationValue: mins * 60,
      summary: 'Direct Line (Fallback)'
    };

    return NextResponse.json(fallbackResult);

  } catch (err: any) {
    console.error('Route API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
