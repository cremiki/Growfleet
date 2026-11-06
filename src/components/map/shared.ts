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

/** Sagome bianche 24x24 per tipo di veicolo, usate quando il veicolo è fermo */
export const TYPE_GLYPH: Record<string, string> = {
  auto: `<path d="M6.5 10.5l1.3-3.2A1.6 1.6 0 0 1 9.3 6.3h5.4a1.6 1.6 0 0 1 1.5 1l1.3 3.2c.9.2 1.5 1 1.5 1.9V16h-1.3v1.2a1 1 0 0 1-2 0V16H8.3v1.2a1 1 0 0 1-2 0V16H5v-3.6c0-.9.6-1.7 1.5-1.9Zm1.7-.2h7.6l-1-2.4H9.2l-1 2.4Zm-.9 3.6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9.4 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="#fff"/>`,
  furgone: `<path d="M4.5 7h10v7h1V9.3h2.3l1.7 2.4V16h-1.3a1.7 1.7 0 0 1-3.4 0H9.6a1.7 1.7 0 0 1-3.4 0H4.5V7Zm11.6 3.4v1.9h2.7l-1.3-1.9h-1.4Z" fill="#fff"/>`,
  camion: `<path d="M3.5 6.5h10.5v8.3h1V8.8h2.6l2.4 3.2V16h-1.2a1.8 1.8 0 0 1-3.6 0H9.4a1.8 1.8 0 0 1-3.6 0H3.5V6.5Zm12.1 3.6v2.2h3l-1.6-2.2h-1.4Z" fill="#fff"/>`,
  moto: `<path d="M7 17.5a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Zm0-1.4a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm10 1.4a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Zm0-1.4a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6ZM9.5 11h3.2l1.5-3H12V6.8h3l1.6 3.6-1 .5-.5-1-2.2 4.4H9.5V11Z" fill="#fff"/>`,
  persona: `<path d="M12 11.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm-5.5 6c0-2.8 2.5-4.5 5.5-4.5s5.5 1.7 5.5 4.5v.8h-11v-.8Z" fill="#fff"/>`,
  macchina: `<path d="M5 15.5V12h3l1.5-4H14v4h1.5l3-3 1 1-3.5 3.5v2H5Zm2 2a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm8 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" fill="#fff"/>`,
  rimorchio: `<path d="M4 7h12v8h3v1.3h-3H8.6a1.7 1.7 0 0 1-3.4 0H4V7Z" fill="#fff"/>`,
};
const SQUARE = `<rect x="7.5" y="7.5" width="9" height="9" rx="1.5" fill="#fff"/>`;
export const glyphFor = (type: string | null | undefined) => (type && TYPE_GLYPH[type]) || SQUARE;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Icona del veicolo + etichetta con il nome (targa), colorate per stato */
export function vehicleMarkerHtml(v: Pick<VehicleState, "status" | "course" | "name" | "label" | "vtype">, selected: boolean): string {
  const c = STATUS_COLOR[v.status];
  const arrow = v.status === "moving"
    ? `<g transform="rotate(${v.course ?? 0} 12 12)"><path d="M12 4 L17.5 17 L12 14 L6.5 17 Z" fill="#fff"/></g>`
    : glyphFor(v.vtype);
  const ring = selected ? "box-shadow:0 0 0 3px #fff,0 0 0 5px #0b4f9c;" : "box-shadow:0 1px 3px rgba(24,33,43,.35);";
  return `<div style="display:flex;align-items:center;gap:0;transform:translate(-12px,-12px);white-space:nowrap;cursor:pointer">
    <span style="display:inline-flex;width:24px;height:24px;border-radius:5px;background:${c};${ring}align-items:center;justify-content:center">
      <svg width="24" height="24" viewBox="0 0 24 24">${arrow}</svg></span>
    <span style="margin-left:3px;padding:1px 6px;border-radius:3px;background:${c};color:#fff;font:600 12px/18px 'Barlow Semi Condensed',sans-serif;box-shadow:0 1px 2px rgba(24,33,43,.3)">${esc(v.label || v.name)}</span>
  </div>`;
}

export function stopMarkerHtml(n: number): string {
  return `<div style="transform:translate(-10px,-10px);width:20px;height:20px;border-radius:3px;background:#2f80ed;color:#fff;font:700 12px/20px 'Barlow',sans-serif;text-align:center;box-shadow:0 0 0 2px #fff">${n}</div>`;
}

export function withPosition(vs: VehicleState[]) {
  return vs.filter((v): v is VehicleState & { lat: number; lon: number } => v.lat !== null && v.lon !== null);
}
