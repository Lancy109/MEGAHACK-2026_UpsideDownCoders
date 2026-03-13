import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat  = searchParams.get('lat');
  const lng  = searchParams.get('lng');
  const type = searchParams.get('type') || 'hospital';

  if (!lat || !lng) return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });

  try {
    const radius = 10000; // 10km
    const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;

    const res  = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(data.error_message || `Places API Error: ${data.status}`);
    }

    const places = (data.results || []).slice(0, 5).map((p: any) => ({
      id:       p.place_id,
      name:     p.name,
      address:  p.vicinity,
      lat:      p.geometry.location.lat,
      lng:      p.geometry.location.lng,
      rating:   p.rating,
      isOpen:   p.opening_hours?.open_now,
      distance: getDistance(parseFloat(lat), parseFloat(lng), p.geometry.location.lat, p.geometry.location.lng),
    }));

    places.sort((a: any, b: any) => a.distance - b.distance);
    return NextResponse.json(places);
  } catch (err: any) {
    console.error('Nearby API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
