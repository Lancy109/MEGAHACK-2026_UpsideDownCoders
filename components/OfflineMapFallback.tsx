'use client';

export interface OfflineMapFallbackProps {
  sosList?: any[];
}

export default function OfflineMapFallback({ sosList = [] }: OfflineMapFallbackProps) {
  // Simple SVG-based static map fallback
  // Shows SOS positions as dots on a grid when maps unavailable
  const width = 600;
  const height = 400;

  // Normalize coordinates to SVG space
  // Maharashtra bounding box: lat 15.6-22.0, lng 72.6-80.9
  function toSVG(lat: number, lng: number) {
    const x = ((lng - 72.6) / (80.9 - 72.6)) * width;
    const y = height - ((lat - 15.6) / (22.0 - 15.6)) * height;
    return { x: Math.max(10, Math.min(width - 10, x)), y: Math.max(10, Math.min(height - 10, y)) };
  }

  const typeColors: Record<string, string> = { MEDICAL: '#ef4444', FOOD: '#eab308', RESCUE: '#3b82f6' };

  return (
    <div className="w-full h-full bg-gray-900 relative flex flex-col items-center justify-center min-h-[300px] rounded-3xl overflow-hidden border border-gray-800">
      <div className="absolute top-4 left-4 z-[500] bg-yellow-950/80 backdrop-blur-sm border border-yellow-700 text-yellow-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg">
        📡 Offline — Local Situation Map
      </div>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="opacity-90">
        {/* Grid lines */}
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * (height / 10)} x2={width} y2={i * (height / 10)} stroke="#1f2937" strokeWidth="1" />
        ))}
        {Array.from({ length: 16 }).map((_, i) => (
          <line key={`v${i}`} x1={i * (width / 15)} y1="0" x2={i * (width / 15)} y2={height} stroke="#1f2937" strokeWidth="1" />
        ))}
        {/* Maharashtra outline approximation text */}
        <text x="10" y="height - 10" fill="#374151" fontSize="10" fontWeight="900" className="uppercase tracking-[0.2em] opacity-50">Operational Region: MS-IN</text>
        
        {/* SOS markers */}
        {sosList.map((sos) => {
          const { x, y } = toSVG(sos.lat, sos.lng);
          return (
            <g key={sos.id} className="cursor-help group">
              <circle cx={x} cy={y} r="12" fill={typeColors[sos.type] || '#ef4444'} opacity="0.2" className="animate-pulse" />
              <circle cx={x} cy={y} r="6" fill={typeColors[sos.type] || '#ef4444'} opacity="0.9" />
              <text x={x + 10} y={y + 4} fill="white" fontSize="10" fontWeight="900" className="select-none">{sos.type[0]}</text>
            </g>
          );
        })}
      </svg>
      
      <div className="absolute bottom-4 right-4 flex gap-4 bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5">
        <span className="flex items-center gap-2 text-[10px] font-black text-slate-300"><span className="w-2 h-2 bg-red-500 rounded-full" />MED</span>
        <span className="flex items-center gap-2 text-[10px] font-black text-slate-300"><span className="w-2 h-2 bg-yellow-500 rounded-full" />FOOD</span>
        <span className="flex items-center gap-2 text-[10px] font-black text-slate-300"><span className="w-2 h-2 bg-blue-500 rounded-full" />RESCUE</span>
      </div>
    </div>
  );
}
