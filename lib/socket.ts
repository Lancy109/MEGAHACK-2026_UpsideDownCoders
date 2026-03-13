declare global {
  var _io: any;
}

export function emitToAll(event: string, data: any) {
  if (global._io) {
    global._io.emit(event, data);
  }
}

export function emitNewSOS(sosData: any) {
  emitToAll('sos_received', sosData);
}

export function emitTaskUpdate(data: any) {
  emitToAll('task_update', data);
}

export function emitSOSResolved(sosId: string) {
  emitToAll('sos_resolved', { sosId });
}

export function emitSOSUpdate(sosData: any) {
  emitToAll('sos_update', sosData);
}
