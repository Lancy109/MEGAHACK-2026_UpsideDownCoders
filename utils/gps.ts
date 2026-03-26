export function detectGPS(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported, using fallback.');
      return resolve({ lat: 19.0760, lng: 72.8777 }); // Mumbai fallback
    }
    
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        console.warn('GPS failed:', err.message);
        throw new Error('GPS_FAILED');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export function getDirectionsURL(lat: number, lng: number, type?: string, origin?: { lat: number; lng: number }) {
  const originStr = origin ? `&origin=${origin.lat},${origin.lng}` : '';
  if (type === 'MEDICAL') {
    // Routes through Victim (Waypoint) to nearest Hospital (Destination)
    return `https://www.google.com/maps/dir/?api=1&destination=Hospital&waypoints=${lat},${lng}${originStr}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${originStr}&travelmode=driving`;
}
