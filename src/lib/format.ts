import type { VehicleStatus } from "./types";

const nf0 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });

export const fmtInt = (n: number | null | undefined) => (n == null ? "—" : nf0.format(n));
export const fmt1 = (n: number | null | undefined) => (n == null ? "—" : nf1.format(n));

export function ago(ts: number | null, now = Date.now() / 1000): string {
  if (!ts) return "mai";
  const s = Math.max(0, Math.round(now - ts));
  if (s < 60) return "adesso";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60 ? `${m % 60} min ` : ""}fa`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ieri" : `${d} giorni fa`;
}

export const fmtDateTime = (ts: number) =>
  new Date(ts * 1000).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const fmtTime = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

export function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Colori dei veicoli: verde acceso e in movimento, arancio acceso ma fermo, rosso spento.
 * Grigio quando il dispositivo non trasmette, grigio chiaro se non ha mai inviato una posizione.
 */
export const STATUS_COLOR: Record<VehicleStatus, string> = {
  moving: "#0a8a4a",
  idle: "#e8710a",
  stopped: "#c62828",
  offline: "#5b6672",
  nodata: "#9aa5b0",
};

export function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
