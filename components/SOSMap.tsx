'use client';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

export interface SOSMapProps {
  sosList?: any[];
  zoom?: number;
  center?: { lat: number; lng: number };
  userLocation?: { lat: number; lng: number } | null;
  routingToId?: string | null;
  showHeatmap?: boolean;
}

// Leaflet cannot be server-rendered — use dynamic import with ssr:false
const LeafletMap = dynamic<SOSMapProps>(
  () => import('./LeafletMap') as Promise<{ default: ComponentType<SOSMapProps> }>,
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500 text-sm animate-pulse">Loading map...</p>
      </div>
    ),
  }
);

export default function SOSMap(props: SOSMapProps) {
  return <LeafletMap {...props} />;
}
