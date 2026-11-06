import type { TrackPoint, VehicleState } from "@/lib/types";
import { STATUS_COLOR } from "@/lib/format";

export type MapProvider = "osm" | "google";

export type FleetMapProps = {
  vehicles: VehicleState[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export type TrackMapProps = {
  points: TrackPoint[];
  cursor: number | null; // indice del punto evidenziato
};

export const ITALY_CENTER: [number, number] = [42.5, 12.5];

/** Icona del veicolo: freccia orientata se in marcia, disco pieno negli altri stati */
export function vehicleSvg(v: Pick<VehicleState, "status" | "course">, selected: boolean): string {
  const size = selected ? 38 : 28;
  const c = STATUS_COLOR[v.status];
  const ring = selected ? `<circle cx="20" cy="20" r="19" fill="none" stroke="#0b4f9c" stroke-width="2.5"/>` : "";
  const inner =
    v.status === "moving"
      ? `<g transform="rotate(${v.course ?? 0} 20 20)"><path d="M20 9 L28 28 L20 23.5 L12 28 Z" fill="#fff"/></g>`
      : `<circle cx="20" cy="20" r="5" fill="#fff"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">${ring}<circle cx="20" cy="20" r="15" fill="${c}" stroke="#fff" stroke-width="2.5"/>${inner}</svg>`;
}

export function withPosition(vs: VehicleState[]) {
  return vs.filter((v): v is VehicleState & { lat: number; lon: number } => v.lat !== null && v.lon !== null);
}

export const TRACK_COLOR = "#0b4f9c";

export function courseAt(points: TrackPoint[], i: number): number {
  const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
  if (!a || !b || (a.lat === b.lat && a.lon === b.lon)) return 0;
  const y = b.lon - a.lon, x = b.lat - a.lat;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
