import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { origin, destination, mode = 'driving' } = await req.json();
    const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;

    if (!origin || !destination) {
      return NextResponse.json({ error: 'Origin and destination required' }, { status: 400 });
    }

    // 1. Get Distance & Time
    const distUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&mode=${mode}&key=${apiKey}`;
    const distRes = await fetch(distUrl);
    const distData = await distRes.json();

    // 2. Get Detailed Polyline for Routing
    const dirUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=${mode}&key=${apiKey}`;
    const dirRes = await fetch(dirUrl);
    const dirData = await dirRes.json();

    if (distData.status !== 'OK' || dirData.status !== 'OK') {
      throw new Error('Google Maps API Error');
    }

    const element = distData.rows[0].elements[0];
    const route   = dirData.routes[0];

    return NextResponse.json({
      distance: element.distance?.text,
      duration: element.duration?.text,
      durationValue: element.duration?.value, // in seconds
      polyline: route.overview_polyline.points,
      summary: route.summary,
      warnings: route.warnings,
    });
  } catch (err: any) {
    console.error('Route API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
