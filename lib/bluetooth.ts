// Bluetooth Mesh Relay Library for ResQNet v3
// BLE Service UUID for ResQNet SOS mesh network
export const BLE_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const BLE_CHAR_UUID    = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

export interface SOSPacket {
  id: string;
  type: 'FOOD' | 'MEDICAL' | 'RESCUE';
  lat: number;
  lng: number;
  timestamp: number;
  ttl: number;
  relayCount: number;
  originDeviceId: string;
}

// In-memory dedup + expiry tracking
const seenPackets = new Map<string, number>(); // id -> timestamp

// Clean expired packets every 60s (5-minute TTL)
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    seenPackets.forEach((ts, id) => {
      if (now - ts > 5 * 60 * 1000) seenPackets.delete(id);
    });
  }, 60_000);
}

// Get or create anonymous device fingerprint
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = localStorage.getItem('resqnet_device_id');
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('resqnet_device_id', id);
  }
  return id;
}

// Serialize packet to Uint8Array
function encodePacket(packet: SOSPacket): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(packet));
}

// Deserialize packet from DataView
function decodePacket(data: DataView): SOSPacket | null {
  try {
    const bytes = new Uint8Array(data.buffer);
    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text) as SOSPacket;
  } catch {
    return null;
  }
}

// Broadcast an SOS packet to nearby devices via BLE GATT
export async function broadcastSOS(packet: SOSPacket): Promise<boolean> {
  if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) return false;
  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ services: [BLE_SERVICE_UUID] }],
    });
    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService(BLE_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(BLE_CHAR_UUID);
    await characteristic.writeValue(encodePacket(packet));
    return true;
  } catch (err) {
    console.warn('[BLE] broadcastSOS failed:', err);
    return false;
  }
}

// Handle an incoming packet: dedup, decrement TTL, rebroadcast, upload if online
export async function handlePacket(
  packet: SOSPacket,
  uploadFn: (p: SOSPacket) => Promise<void>
): Promise<void> {
  // Dedup
  if (seenPackets.has(packet.id)) return;
  seenPackets.set(packet.id, Date.now());

  // Upload if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try { await uploadFn(packet); } catch { /* ignore */ }
  }

  // Rebroadcast with decremented TTL
  if (packet.ttl > 0) {
    const relay: SOSPacket = {
      ...packet,
      ttl: packet.ttl - 1,
      relayCount: packet.relayCount + 1,
    };
    await broadcastSOS(relay);
  }
}

// Start scanning for BLE SOS packets
export async function startScanning(
  onPacket: (packet: SOSPacket) => void,
  uploadFn: (p: SOSPacket) => Promise<void>
): Promise<() => void> {
  if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
    throw new Error('Web Bluetooth not supported');
  }

  // Try requestLEScan (Chrome flag) first
  if ((navigator as any).bluetooth.requestLEScan) {
    try {
      const scan = await (navigator as any).bluetooth.requestLEScan({
        filters: [{ services: [BLE_SERVICE_UUID] }],
      });
      const listener = (event: any) => {
        const packet = decodePacket(event.device?.adData);
        if (packet) {
          onPacket(packet);
          handlePacket(packet, uploadFn);
        }
      };
      (navigator as any).bluetooth.addEventListener('advertisementreceived', listener);
      return () => {
        scan.stop();
        (navigator as any).bluetooth.removeEventListener('advertisementreceived', listener);
      };
    } catch { /* fall through to GATT */ }
  }

  // Fallback: requestDevice + GATT connect + characteristic subscribe
  let stopped = false;
  const device = await (navigator as any).bluetooth.requestDevice({
    filters: [{ services: [BLE_SERVICE_UUID] }],
  });
  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService(BLE_SERVICE_UUID);
  const char = await service.getCharacteristic(BLE_CHAR_UUID);
  await char.startNotifications();
  char.addEventListener('characteristicvaluechanged', (e: any) => {
    if (stopped) return;
    const packet = decodePacket(e.target.value as DataView);
    if (packet) {
      onPacket(packet);
      handlePacket(packet, uploadFn);
    }
  });

  return () => {
    stopped = true;
    char.stopNotifications().catch(() => {});
    server.disconnect();
  };
}
