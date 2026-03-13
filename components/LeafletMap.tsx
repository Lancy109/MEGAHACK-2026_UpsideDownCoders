'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet's default marker icon broken by bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const typeColors: Record<string, string> = {
  MEDICAL: '#ef4444', // red
  FOOD:    '#eab308', // yellow
  RESCUE:  '#3b82f6', // blue
};

export interface SOSMapProps {
  sosList?: any[];
  zoom?: number;
  center?: { lat: number; lng: number };
  userLocation?: { lat: number; lng: number } | null;
  routingToId?: string | null;
  showHeatmap?: boolean;
}

const DEFAULT_CENTER: [number, number] = [19.7515, 75.7139]; // Maharashtra, India

export default function LeafletMap({ sosList = [], zoom = 7, center, userLocation, routingToId, showHeatmap }: SOSMapProps) {
  const mapRef    = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Layer[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const heatmapLayerRef = useRef<any>(null);
  const divRef    = useRef<HTMLDivElement>(null);

  // Initialise map once
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;

    const map = L.map(divRef.current, {
      center: center ? [center.lat, center.lng] : DEFAULT_CENTER,
      zoom,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle container resizes (solves partial grey tile rendering when sidebar toggles)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !divRef.current) return;

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    
    observer.observe(divRef.current);

    return () => observer.disconnect();
  }, []);

  // Sync User Location Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `<div class="pulse-container">
                <div class="pulse-core"></div>
                <div class="pulse-ring"></div>
               </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map);
    }
  }, [userLocation]);

  // Tactical Routing Line
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    if (userLocation && routingToId) {
      const target = sosList.find((s) => s.id === routingToId);
      if (target) {
        routeLineRef.current = L.polyline(
          [
            [userLocation.lat, userLocation.lng],
            [target.lat, target.lng]
          ],
          {
            color: '#059669', // Emerald-600
            weight: 5,
            opacity: 0.9,
            dashArray: '12, 12',
            lineJoin: 'round'
          }
        ).addTo(map);
        
        // Optionally fit bounds if target is far
        // map.fitBounds(routeLineRef.current.getBounds(), { padding: [50, 50] });
      }
    }
  }, [userLocation, routingToId, sosList]);

  // Update markers when sosList changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    markerRef.current.forEach((m) => m.remove());
    markerRef.current = [];

    // Add new markers
    sosList.forEach((sos) => {
      const color = typeColors[sos.type] || typeColors.RESCUE;

      const marker = L.circleMarker([sos.lat, sos.lng], {
        radius: 12,
        fillColor: color,
        color: '#fff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
      }).addTo(map);

      marker.bindPopup(`
        <div style="background:#fff;color:#1e293b;padding:12px;border-radius:12px;min-width:180px;font-family:sans-serif">
          <strong style="color:${color};font-size:14px;text-transform:uppercase;letter-spacing:0.05em">${sos.type}</strong>
          <div style="height:1px;background:#e2e8f0;margin:8px 0"></div>
          <p style="font-size:12px;margin:0 0 8px;line-height:1.4;font-weight:500">${sos.description || ''}</p>
          <div style="display:flex;align-items:center;gap:6px;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;font-weight:900">
             <span>VICTIM:</span> <span style="color:#0f172a">${sos.user?.name || 'Unknown'}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-top:4px;font-weight:900">
             <span>STATUS:</span> <span style="color:#0f172a">${sos.status}</span>
          </div>
        </div>
      `, { className: 'leaflet-custom-popup' });

      markerRef.current.push(marker);
    });
  }, [sosList]);

  // Heatmap Layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (heatmapLayerRef.current) {
      map.removeLayer(heatmapLayerRef.current);
      heatmapLayerRef.current = null;
    }

    if (showHeatmap && sosList.length > 0) {
      // @ts-ignore - leaflet.heat is a side-effect plugin
      import('leaflet.heat').then(() => {
        const points = sosList.map((s) => {
          let weight = 0;
          if (s.status === 'RESOLVED') return [s.lat, s.lng, 0];
          
          // Base weight by type
          const typeWeight = s.type === 'RESCUE' ? 1.0 : s.type === 'MEDICAL' ? 0.7 : 0.4;
          // Multiplier by status
          const statusMult = s.status === 'ACTIVE' ? 1.0 : 0.6;
          
          return [s.lat, s.lng, typeWeight * statusMult];
        });
        
        // @ts-ignore
        heatmapLayerRef.current = L.heatLayer(points, {
          radius: 35,
          blur: 20,
          maxZoom: 13,
          gradient: {
            0.2: 'indigo',
            0.4: 'blue',
            0.6: 'cyan',
            0.7: 'lime',
            0.8: 'yellow',
            1.0: 'red'
          }
        }).addTo(map);
      });
    }
  }, [showHeatmap, sosList]);

  // Update center/zoom if props change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (center) map.setView([center.lat, center.lng], zoom);
  }, [center, zoom]);

  return (
    <>
      <style>{`
        .user-location-marker {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pulse-container {
          position: relative;
          width: 20px;
          height: 20px;
        }
        .pulse-core {
          position: absolute;
          top: 5px;
          left: 5px;
          width: 10px;
          height: 10px;
          background-color: #3b82f6;
          border: 2px solid white;
          border-radius: 50%;
          z-index: 2;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
        }
        .pulse-ring {
          position: absolute;
          top: 0;
          left: 0;
          width: 20px;
          height: 20px;
          background-color: #3b82f6;
          border-radius: 50%;
          opacity: 0.4;
          animation: map-pulse 2s infinite ease-out;
        }
        @keyframes map-pulse {
          0% { transform: scale(0.5); opacity: 0.8; }
          100% { transform: scale(3); opacity: 0; }
        }
        .leaflet-custom-popup .leaflet-popup-content-wrapper {
          background: #fff !important;
          border: none;
          border-radius: 16px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
          padding: 0 !important;
        }
        .leaflet-custom-popup .leaflet-popup-tip {
          background: #fff !important;
          box-shadow: none !important;
        }
        .leaflet-custom-popup .leaflet-popup-content {
          margin: 0;
        }
        .leaflet-container {
          background: #f8fafc;
        }
        .leaflet-control-attribution {
          background: rgba(255, 255, 255, 0.8) !important;
          backdrop-filter: blur(4px);
          color: #94a3b8 !important;
          font-size: 10px !important;
          border-top-left-radius: 8px;
          padding: 2px 8px !important;
        }
        .leaflet-control-attribution a { color: #64748b !important; }
        .leaflet-bar { border: none !important; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important; }
        .leaflet-bar a { background: #fff !important; color: #1e293b !important; border-bottom: 1px solid #f1f5f9 !important; }
        .leaflet-bar a:hover { background: #f8fafc !important; }

        .heatmap-legend {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(8px);
          padding: 8px 12px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.1);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .legend-item { display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 800; color: #475569; }
        .legend-gradient {
          height: 8px;
          width: 80px;
          background: linear-gradient(to right, indigo, blue, cyan, lime, yellow, red);
          border-radius: 4px;
        }
`}</style>
      <div ref={divRef} style={{ width: '100%', height: '100%', minHeight: '300px' }} />
      {showHeatmap && (
        <div className="absolute bottom-12 right-4 z-[500] heatmap-legend slide-in">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Impact Density</p>
          <div className="legend-gradient" />
          <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase">
            <span>Low</span>
            <span>Critical</span>
          </div>
          <div className="h-px bg-slate-100 my-1" />
          <div className="legend-item">
            <span className="w-2 h-2 rounded-full bg-red-500" /> RESCUE (Highest)
          </div>
          <div className="legend-item">
            <span className="w-2 h-2 rounded-full bg-yellow-500" /> MEDICAL
          </div>
          <div className="legend-item">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> FOOD
          </div>
        </div>
      )}
    </>
  );
}
