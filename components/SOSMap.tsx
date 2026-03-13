'use client';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

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

// Leaflet cannot be server-rendered — use dynamic import with ssr:false
const LeafletMap = dynamic<SOSMapProps>(
  () => import('./LeafletMap') as Promise<{ default: ComponentType<SOSMapProps> }>,
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
        <p className="text-slate-400 text-sm animate-pulse font-bold uppercase tracking-widest">Loading map...</p>
      </div>
    ),
  }
);

export default function SOSMap(props: SOSMapProps) {
  return <LeafletMap {...props} />;
}
