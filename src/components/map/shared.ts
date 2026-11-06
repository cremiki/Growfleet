import type { TrackPoint, VehicleState } from "@/lib/types";
import type { Stop } from "@/lib/trips";
import { STATUS_COLOR } from "@/lib/format";

export type MapProvider = "osm" | "google";

export type RouteOverlay = {
  key: string; // cambia quando cambia il percorso, per ricentrare la mappa
  points: TrackPoint[];
  stops: Stop[];
  highlight: [number, number] | null; // tratto evidenziato (indici in points)
};

export type Focus = { lat: number; lon: number; zoom?: number; key: string };

export type LiveMapProps = {
  vehicles: VehicleState[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  route: RouteOverlay | null;
  focus: Focus | null;
  fitAllKey: number; // incrementato da "Mostra tutti"
};

export const ITALY_CENTER: [number, number] = [42.5, 12.5];
export const ROUTE_COLOR = "#2f80ed";
export const HIGHLIGHT_COLOR = "#0b4f9c";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Icona del veicolo + etichetta con il nome (targa), colorate per stato */
export function vehicleMarkerHtml(v: Pick<VehicleState, "status" | "course" | "name">, selected: boolean): string {
  const c = STATUS_COLOR[v.status];
  const arrow = v.status === "moving"
    ? `<g transform="rotate(${v.course ?? 0} 12 12)"><path d="M12 4 L17.5 17 L12 14 L6.5 17 Z" fill="#fff"/></g>`
    : `<rect x="7.5" y="7.5" width="9" height="9" rx="1.5" fill="#fff"/>`;
  const ring = selected ? "box-shadow:0 0 0 3px #fff,0 0 0 5px #0b4f9c;" : "box-shadow:0 1px 3px rgba(24,33,43,.35);";
  return `<div style="display:flex;align-items:center;gap:0;transform:translate(-12px,-12px);white-space:nowrap;cursor:pointer">
    <span style="display:inline-flex;width:24px;height:24px;border-radius:5px;background:${c};${ring}align-items:center;justify-content:center">
      <svg width="24" height="24" viewBox="0 0 24 24">${arrow}</svg></span>
    <span style="margin-left:3px;padding:1px 6px;border-radius:3px;background:${c};color:#fff;font:600 12px/18px 'Barlow Semi Condensed',sans-serif;box-shadow:0 1px 2px rgba(24,33,43,.3)">${esc(v.name)}</span>
  </div>`;
}

export function stopMarkerHtml(n: number): string {
  return `<div style="transform:translate(-10px,-10px);width:20px;height:20px;border-radius:3px;background:#2f80ed;color:#fff;font:700 12px/20px 'Barlow',sans-serif;text-align:center;box-shadow:0 0 0 2px #fff">${n}</div>`;
}

export function withPosition(vs: VehicleState[]) {
  return vs.filter((v): v is VehicleState & { lat: number; lon: number } => v.lat !== null && v.lon !== null);
}
