import type { Cell, ColKind } from "./types";
import { isPlace } from "./types";

const n0 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
const n1 = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n2 = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const d2 = (n: number) => String(n).padStart(2, "0");

export function durText(sec: number) {
  const m = Math.round(sec / 60);
  if (m < 1) return sec > 0 ? "<1min" : "0";
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}H ${d2(m % 60)}min`;
}

/**
 * Testo di una cella. `address` risolve i luoghi (indirizzo se noto, altrimenti coordinate).
 */
export function cellText(kind: ColKind, v: Cell, address?: (lat: number, lon: number) => string | undefined, compact = false): string {
  if (v === null || v === undefined || v === "") return "";
  // griglie mensili: solo il numero, l'unità è nel titolo del report
  if (compact && typeof v === "number" && kind === "km") return v === 0 ? "0" : n1.format(v);
  if (isPlace(v)) {
    const coords = `${v.lat.toFixed(5)}, ${v.lon.toFixed(5)}`;
    return kind === "address" ? address?.(v.lat, v.lon) ?? coords : coords;
  }
  if (typeof v === "boolean") return v ? "ON" : "OFF";
  if (typeof v === "string") return v;
  const d = new Date(v * 1000);
  switch (kind) {
    case "km": return v < 1 && v > 0 ? `${n0.format(v * 1000)} m` : `${n1.format(v)} km`;
    case "dur": return durText(v);
    case "hours": return v === 0 ? "0" : `${Math.floor(v / 3600)}:${d2(Math.round((v % 3600) / 60))}`;
    case "time": return `${d2(d.getHours())}:${d2(d.getMinutes())}`;
    case "date": return `${d2(d.getDate())}/${d2(d.getMonth() + 1)}/${d.getFullYear()}`;
    case "datetime": return `${d2(d.getDate())}/${d2(d.getMonth() + 1)}/${d.getFullYear()} ${d2(d.getHours())}:${d2(d.getMinutes())}`;
    case "speed": return `${n0.format(v)} km/h`;
    case "liters": return `${n1.format(v)} l`;
    case "volt": return `${n2.format(v)} V`;
    case "onoff": return v ? "ON" : "OFF";
    case "int": return n0.format(v);
    default: return String(v);
  }
}

/** Valore per Excel: numeri senza unità (con virgola decimale), testi così come sono */
export function cellCsv(kind: ColKind, v: Cell, address?: (lat: number, lon: number) => string | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && ["km", "speed", "liters", "volt", "int"].includes(kind)) {
    return (Math.round(v * 100) / 100).toString().replace(".", ",");
  }
  return cellText(kind, v, address);
}

export const UNIT: Partial<Record<ColKind, string>> = { km: "km", speed: "km/h", liters: "l", volt: "V", hours: "h:mm" };
export const NUMERIC: ColKind[] = ["int", "km", "dur", "hours", "speed", "liters", "volt"];
