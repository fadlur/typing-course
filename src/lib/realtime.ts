/** Hub WebSocket untuk leaderboard real-time per sesi latihan. */
import type { ServerWebSocket } from "bun";

const rooms = new Map<string, Set<ServerWebSocket<unknown>>>();

/** Registrasi koneksi ke ruangan sesi. */
export function joinRoom(slug: string, ws: ServerWebSocket<unknown>): void {
  let set = rooms.get(slug);
  if (!set) {
    set = new Set();
    rooms.set(slug, set);
  }
  set.add(ws);
}

/** Lepas koneksi dari ruangan sesi. */
export function leaveRoom(slug: string, ws: ServerWebSocket<unknown>): void {
  const set = rooms.get(slug);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) rooms.delete(slug);
}

/** Broadcast payload JSON ke semua client di ruangan sesi. */
export function broadcast(slug: string, payload: unknown): void {
  const set = rooms.get(slug);
  if (!set) return;
  const msg = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === 1) {
      try {
        ws.send(msg);
      } catch {
        /* abaikan koneksi mati */
      }
    }
  }
}

export function roomSize(slug: string): number {
  return rooms.get(slug)?.size ?? 0;
}
