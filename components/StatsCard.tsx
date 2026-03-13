'use client';
import { useEffect, useState } from 'react';

interface StatsCardProps {
  count: number;
  label: string;
  color: 'red' | 'yellow' | 'green';
  icon: string;
}

export default function StatsCard({ count, label, color, icon }: StatsCardProps) {
  const [displayCount, setDisplayCount] = useState(0);

  useEffect(() => {
    // Simple count-up animation
    let start = 0;
    const duration = 1000;
    const increment = count / (duration / 16);
    
    if (count === 0) return setDisplayCount(0);

    const timer = setInterval(() => {
      start += increment;
      if (start >= count) {
        setDisplayCount(count);
        clearInterval(timer);
      } else {
        setDisplayCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [count]);

  const colorStyles = {
    red:    'bg-red-50 text-red-600 border border-red-100 shadow-red-100/50',
    yellow: 'bg-yellow-50 text-yellow-600 border border-yellow-100 shadow-yellow-100/50',
    green:  'bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-emerald-100/50',
  };

  return (
    <div className={`p-6 rounded-3xl flex items-center justify-between transition-all hover:-translate-y-1 shadow-sm hover:shadow-md ${colorStyles[color]}`}>
      <div>
        <p className={`text-xs font-black uppercase tracking-widest mb-1 opacity-70`}>
          {label}
        </p>
        <p className={`text-4xl font-black tracking-tight`}>
          {displayCount}
        </p>
      </div>
      <div className="text-4xl opacity-90 drop-shadow-sm">{icon}</div>
    </div>
  );
}
