'use client';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useSyncEngine } from '@/hooks/useSyncEngine';

export default function NetworkBanner() {
  const { isOnline, wasOffline, connectionType } = useNetworkStatus();
  const { syncAll } = useSyncEngine();

  if (isOnline && !wasOffline) return null;

  return (
    <div className={`fixed top-16 left-0 right-0 z-50 text-center py-2 text-sm font-bold transition-all ${
      isOnline
        ? 'bg-green-900 border-b border-green-700 text-green-300'
        : 'bg-red-950 border-b border-red-700 text-red-300 animate-pulse'
    }`}>
      {isOnline
        ? `✅ Back online — syncing your data...`
        : `📡 You are offline — SOS will be saved and sent when connected`}
      {!isOnline && connectionType !== 'unknown' && (
        <span className="ml-2 text-xs opacity-70">({connectionType})</span>
      )}
      {isOnline && (
        <button onClick={syncAll} className="ml-3 underline text-xs hover:no-underline">
          Sync now
        </button>
      )}
    </div>
  );
}
