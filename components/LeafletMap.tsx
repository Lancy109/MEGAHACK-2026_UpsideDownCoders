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
  volunteerList?: any[];
  zoom?: number;
  center?: { lat: number; lng: number };
  userLocation?: { lat: number; lng: number } | null;
  routingToId?: string | null;
  showHeatmap?: boolean;
  satellite?: boolean;
  onPinClick?: (sos: any) => void;
}

const DEFAULT_CENTER: [number, number] = [19.7515, 75.7139]; // Maharashtra, India

export default function LeafletMap({ 
  sosList = [], 
  volunteerList = [], 
  zoom = 7, 
  center, 
  userLocation, 
  routingToId, 
  showHeatmap, 
  satellite, 
  onPinClick 
}: SOSMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Layer[]>([]);
  const volunteerMarkerRef = useRef<L.Layer[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.LayerGroup | null>(null);
  const heatmapLayerRef = useRef<any>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Initialise map once
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;

    const map = L.map(divRef.current, {
      center: center ? [center.lat, center.lng] : DEFAULT_CENTER,
      zoom,
      zoomControl: true,
    });

    mapRef.current = map;

    tileLayerRef.current = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors',
        subdomains: 'abcd',
        maxZoom: 20,
      }
    ).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle container resizes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !divRef.current) return;
    const observer = new ResizeObserver(() => { map.invalidateSize(); });
    observer.observe(divRef.current);
    return () => observer.disconnect();
  }, []);

  // Swap tile layers (Satellite vs Voyager)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try { map.getContainer(); } catch { return; }

    const tileUrl = satellite
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    map.eachLayer((layer: any) => {
      if (layer instanceof L.TileLayer) map.removeLayer(layer);
    });

    const tileOptions: any = {
      attribution: satellite ? '&copy; Esri World Imagery' : '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
      maxZoom: 20,
    };
    if (!satellite) tileOptions.subdomains = 'abcd';

    tileLayerRef.current = L.tileLayer(tileUrl, tileOptions).addTo(map);
  }, [satellite]);

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
        html: `<div class="pulse-container"><div class="pulse-core"></div><div class="pulse-ring"></div></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map);
    }
  }, [userLocation]);

  // Render Volunteer Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    volunteerMarkerRef.current.forEach(m => m.remove());
    volunteerMarkerRef.current = [];

    volunteerList.forEach(v => {
      if (v.lat && v.lng) {
        const volIcon = L.divIcon({
          className: 'volunteer-marker',
          html: `<div class="vol-pin bg-emerald-500 border-2 border-white shadow-lg w-3 h-3 rounded-full"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        const marker = L.marker([v.lat, v.lng], { icon: volIcon })
          .addTo(map)
          .bindTooltip(`<p class="text-[9px] font-black uppercase tracking-widest px-1 py-0.5">${v.name}</p>`, { 
            direction: 'top', 
            permanent: false,
            className: 'tooltip-custom'
          });
        volunteerMarkerRef.current.push(marker);
      }
    });
  }, [volunteerList]);

  // Mission Trails and SOS Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers and trails
    markerRef.current.forEach(m => m.remove());
    markerRef.current = [];
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    const trails = L.layerGroup().addTo(map);
    routeLineRef.current = trails;

    sosList.forEach(sos => {
      const color = typeColors[sos.type] || typeColors.RESCUE;
      const isAssigned = sos.status === 'ASSIGNED';

      const marker = L.circleMarker([sos.lat, sos.lng], {
        radius: isAssigned ? 10 : 14,
        fillColor: color,
        color: '#fff',
        weight: isAssigned ? 2 : 4,
        opacity: 1,
        fillOpacity: isAssigned ? 0.7 : 0.9,
      }).addTo(map);

      if (isAssigned) {
        const volunteerInfo = sos.tasks?.find((t: any) => t.status === 'ACCEPTED' || t.status === 'ENROUTE');
        const volName = volunteerInfo?.volunteer?.name || 'Assigned';
        
        marker.bindTooltip(`<div class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-fast"></span><span class="text-[8px] font-black uppercase tracking-widest">${volName}</span></div>`, {
          permanent: true,
          direction: 'bottom',
          offset: [0, 8],
          className: 'mission-label'
        });

        // Drawing the line from volunteer to victim
        const volId = volunteerInfo?.volunteerId || volunteerInfo?.volunteer?.id;
        const vPos = volunteerList.find(v => v.id === volId);
        if (vPos && vPos.lat && vPos.lng) {
          L.polyline([[vPos.lat, vPos.lng], [sos.lat, sos.lng]], {
            color: '#10b981',
            weight: 3,
            dashArray: '8, 8',
            opacity: 0.6,
            lineCap: 'round'
          }).addTo(trails);
        }
      }

      if (onPinClick) marker.on('click', () => onPinClick(sos));
      
      marker.bindPopup(`
        <div style="background:#fff;padding:12px;border-radius:12px;min-width:180px;font-family:sans-serif">
          <strong style="color:${color};font-size:12px;text-transform:uppercase;letter-spacing:0.1em">${sos.type}</strong>
          <div style="height:1px;background:#f1f5f9;margin:8px 0"></div>
          <p style="font-size:11px;color:#475569;margin-bottom:8px">${sos.description}</p>
          <p style="font-size:9px;font-weight:900;color:#94a3b8;text-transform:uppercase">Status: <span style="color:#1e293b">${sos.status}</span></p>
          <p style="font-size:9px;font-weight:900;color:#94a3b8;text-transform:uppercase">Victim: <span style="color:#1e293b">${sos.user?.name || 'Unknown'}</span></p>
        </div>
      `, { className: 'leaflet-custom-popup' });

      markerRef.current.push(marker);
    });

    // Handle individual tactical routing if provided
    if (userLocation && routingToId) {
      const t = sosList.find(s => s.id === routingToId);
      if (t) {
        L.polyline([[userLocation.lat, userLocation.lng], [t.lat, t.lng]], {
          color: '#34d399',
          weight: 6,
          dashArray: '12, 12',
          opacity: 0.9
        }).addTo(trails);
      }
    }
  }, [sosList, volunteerList, userLocation, routingToId]);

  // Heatmap Overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (heatmapLayerRef.current) {
      map.removeLayer(heatmapLayerRef.current);
      heatmapLayerRef.current = null;
    }
    if (showHeatmap && sosList.length > 0) {
      // @ts-ignore
      import('leaflet.heat').then(() => {
        const pts = sosList.map(s => {
          if (s.status === 'RESOLVED') return [s.lat, s.lng, 0];
          const w = s.type === 'RESCUE' ? 1.0 : s.type === 'MEDICAL' ? 0.7 : 0.4;
          const m = s.status === 'ACTIVE' ? 1.0 : 0.6;
          return [s.lat, s.lng, w * m];
        });
        // @ts-ignore
        heatmapLayerRef.current = L.heatLayer(pts, { radius: 35, blur: 20, maxZoom: 13 }).addTo(map);
      });
    }
  }, [showHeatmap, sosList]);

  // Center/Zoom updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    map.setView([center.lat, center.lng], zoom);
  }, [center, zoom]);

  return (
    <>
      <style>{`
        .tooltip-custom { background: white !important; border: 1px solid #e2e8f0 !important; border-radius: 8px !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1) !important; padding: 2px 4px !important; }
        .mission-label { background: rgba(255,255,255,0.9) !important; border: 1px solid #10b981 !important; border-radius: 4px !important; box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important; padding: 1px 4px !important; pointer-events: none; }
        .pulse-fast { animation: pulse-emerald 0.8s infinite cubic-bezier(0.66, 0, 0, 1); }
        @keyframes pulse-emerald { 0% { opacity: 0.4; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1.2); } }
        .user-location-marker { display: flex; align-items: center; justify-content: center; }
        .pulse-container { position: relative; width: 20px; height: 20px; }
        .pulse-core { position: absolute; top: 5px; left: 5px; width: 10px; height: 10px; background-color: #3b82f6; border: 2px solid white; border-radius: 50%; z-index: 2; }
        .pulse-ring { position: absolute; top: 0; left: 0; width: 20px; height: 20px; background-color: #3b82f6; border-radius: 50%; opacity: 0.4; animation: map-pulse 2s infinite ease-out; }
        @keyframes map-pulse { 0% { transform: scale(0.5); opacity: 0.8; } 100% { transform: scale(3); opacity: 0; } }
        .leaflet-custom-popup .leaflet-popup-content-wrapper { border-radius: 16px !important; padding: 0 !important; overflow: hidden; }
        .leaflet-container { background: #f8fafc; }
        .leaflet-control-attribution { border-top-left-radius: 8px; font-size: 9px !important; }
      `}</style>
      <div ref={divRef} className="w-full h-full" />
      
      {showHeatmap && (
        <div className="absolute bottom-12 right-4 z-[500] bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl flex flex-col gap-2 scale-in">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Impact Density</p>
          <div className="h-2 w-24 bg-gradient-to-r from-indigo-500 via-cyan-500 to-red-500 rounded-full" />
          <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase">
            <span>Low</span>
            <span>Critical</span>
          </div>
        </div>
      )}
    </>
  );
}
