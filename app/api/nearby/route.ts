import { NextResponse } from 'next/server';

async function fetchOverpassPlaces(lat: number, lng: number, type: string) {
  const osmTypeMap: Record<string, string[]> = {
    hospital: ['hospital', 'clinic', 'doctors'],
    police: ['police'],
    fire_station: ['fire_station'],
    pharmacy: ['pharmacy']
  };

  const amenities = osmTypeMap[type] || ['hospital'];
  const amenityQuery = amenities.map(a => `node["amenity"="${a}"](around:10000,${lat},${lng});way["amenity"="${a}"](around:10000,${lat},${lng});relation["amenity"="${a}"](around:10000,${lat},${lng});`).join('');
  const query = `[out:json];(${amenityQuery});out center;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ResQNet Emergency App (https://resqnet.com)'
      }
    });
    const data = await res.json();
    return (data.elements || []).map((p: any) => {
      const name = p.tags.name || `${amenities[0].charAt(0).toUpperCase() + amenities[0].slice(1)}`;
      const houseNum = p.tags['addr:housenumber'] || '';
      const street = p.tags['addr:street'] || '';
      const suburb = p.tags['addr:suburb'] || '';
      const city = p.tags['addr:city'] || '';
      const fullAddr = p.tags['addr:full'] || `${houseNum} ${street} ${suburb} ${city}`.trim() || 'Near ' + name;

      return {
        id: `osm_${p.id}`,
        name: name,
        address: fullAddr,
        lat: p.lat || p.center?.lat,
        lng: p.lon || p.center?.lon,
        rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)), // Still random as OSM doesn't have ratings
        isOpen: true,
        distance: getDistance(lat, lng, p.lat || p.center?.lat, p.lon || p.center?.lon),
      };
    });
  } catch (err) {
    console.error('Overpass API error:', err);
    return [];
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');
  const type = searchParams.get('type') || 'hospital';

  if (!latStr || !lngStr) return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  try {
    const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
    let places = [];

    if (apiKey) {
      const radius = 5000;
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK') {
        places = (data.results || []).slice(0, 10).map((p: any) => ({
          id: p.place_id,
          name: p.name,
          address: p.vicinity,
          lat: p.geometry.location.lat,
          lng: p.geometry.location.lng,
          rating: p.rating,
          isOpen: p.opening_hours?.open_now,
          distance: getDistance(lat, lng, p.geometry.location.lat, p.geometry.location.lng),
        }));
      }
    }

    // Fallback to Overpass API if Google fails or key is missing
    if (places.length === 0) {
      console.log('Using Overpass API for real-world locations.');
      places = await fetchOverpassPlaces(lat, lng, type);
    }

    // Filter out any results without coordinates and sort strictly by distance
    const filteredPlaces = places
      .filter((p: any) => p.lat !== undefined && p.lng !== undefined)
      .sort((a: any, b: any) => a.distance - b.distance)
      .slice(0, 15);

    return NextResponse.json(filteredPlaces);
  } catch (err: any) {
    console.error('Nearby API error fallback:', err);
    return NextResponse.json([]);
  }
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function generateMockPlaces(lat: number, lng: number, type: string) {
  const types: Record<string, string[]> = {
    hospital: ['City Medical Center', 'Regional General Hospital', 'Emergency Care Unit'],
    police: ['Central Police Station', 'Metro Precinct', 'Highway Patrol HQ'],
    fire_station: ['Fire Dept Station 4', 'Central Fire Station', 'Emergency Rescue Squad'],
    pharmacy: ['24/7 Pharmacy', 'City Health Meds', 'Community Drugstore']
  };

  const names = types[type] || types.hospital;

  return names.map((name, i) => {
    const pLat = lat + (Math.random() - 0.5) * 0.05;
    const pLng = lng + (Math.random() - 0.5) * 0.05;
    return {
      id: `mock_${type}_${i}`,
      name: name,
      address: `Sector ${i + 1}, Near Highway, District Zone`,
      lat: pLat,
      lng: pLng,
      rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)),
      isOpen: true,
      distance: getDistance(lat, lng, pLat, pLng)
    };
  }).sort((a, b) => a.distance - b.distance);
}
