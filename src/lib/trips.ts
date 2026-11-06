import type { TrackPoint } from "./types";
import { haversineKm } from "./format";

/**
 * Dai punti grezzi a una cronologia di soste e tragitti, come la scheda Itinerari.
 * Una sosta è un periodo fermo di almeno MIN_STOP_S; le soste più brevi restano dentro il tragitto.
 */
const MOVING_KMH = 3;
const MIN_STOP_S = 5 * 60;
const MAX_JUMP_KM = 50; // scarta salti GPS anomali

export type Stop = { kind: "stop"; n: number; lat: number; lon: number; start: number; end: number; idx: number };
export type Trip = { kind: "trip"; km: number; start: number; end: number; startIdx: number; endIdx: number; maxSpeed: number };
export type TimelineItem = Stop | Trip;

export type DaySummary = {
  km: number;
  movingS: number;
  stoppedS: number;
  maxSpeed: number;
  odoStart: number | null;
  odoEnd: number | null;
  fuelUsed: number | null; // litri, dal contatore CAN
};

export type Timeline = { items: TimelineItem[]; summary: DaySummary };

function dist(points: TrackPoint[], from: number, to: number) {
  let km = 0;
  for (let i = Math.max(1, from); i <= to; i++) {
    const d = haversineKm([points[i - 1].lat, points[i - 1].lon], [points[i].lat, points[i].lon]);
    if (d < MAX_JUMP_KM) km += d;
  }
  return km;
}

/**
 * @param from inizio del periodo (es. mezzanotte), per far partire la prima sosta da lì
 * @param to   fine del periodo (es. ora attuale o mezzanotte successiva)
 */
export function buildTimeline(points: TrackPoint[], from: number, to: number): Timeline {
  const pts = points.filter((p) => p.ts >= from && p.ts <= to);
  const empty: DaySummary = { km: 0, movingS: 0, stoppedS: Math.max(0, to - from), maxSpeed: 0, odoStart: null, odoEnd: null, fuelUsed: null };
  if (pts.length === 0) return { items: [], summary: empty };

  // 1. sequenze consecutive di punti in movimento / fermi
  type Run = { moving: boolean; a: number; b: number };
  const runs: Run[] = [];
  pts.forEach((p, i) => {
    const moving = (p.speed ?? 0) > MOVING_KMH;
    const last = runs[runs.length - 1];
    if (last && last.moving === moving) last.b = i;
    else runs.push({ moving, a: i, b: i });
  });
  const tEnd = (k: number) => (k + 1 < runs.length ? pts[runs[k + 1].a].ts : to);

  // 2. le soste troppo brevi fra due tratti in movimento diventano parte del tragitto
  const merged: Run[] = [];
  runs.forEach((r, k) => {
    const short = !r.moving && k > 0 && k < runs.length - 1 && tEnd(k) - pts[r.a].ts < MIN_STOP_S;
    const asMoving = r.moving || short;
    const last = merged[merged.length - 1];
    if (last && last.moving === asMoving) last.b = r.b;
    else merged.push({ moving: asMoving, a: r.a, b: r.b });
  });

  // 3. cronologia
  const items: TimelineItem[] = [];
  let n = 0, km = 0, movingS = 0, stoppedS = 0, maxSpeed = 0;
  merged.forEach((r, k) => {
    const start = k === 0 ? from : pts[r.a].ts;
    const end = k + 1 < merged.length ? pts[merged[k + 1].a].ts : to;
    if (r.moving) {
      const a = Math.max(0, r.a - 1);
      const b = Math.min(pts.length - 1, r.b + 1);
      const tripKm = dist(pts, a + 1, b);
      let ms = 0;
      for (let i = r.a; i <= r.b; i++) ms = Math.max(ms, pts[i].speed ?? 0);
      km += tripKm; movingS += end - start; maxSpeed = Math.max(maxSpeed, ms);
      items.push({ kind: "trip", km: tripKm, start, end, startIdx: a, endIdx: b, maxSpeed: ms });
    } else {
      stoppedS += end - start;
      items.push({ kind: "stop", n: ++n, lat: pts[r.a].lat, lon: pts[r.a].lon, start, end, idx: r.a });
    }
  });

  const odos = pts.map((p) => p.odometer).filter((v): v is number => v != null);
  const fuel = pts.map((p) => p.fuelUsed).filter((v): v is number => v != null);
  return {
    items,
    summary: {
      km, movingS, stoppedS, maxSpeed,
      odoStart: odos[0] ?? null,
      odoEnd: odos[odos.length - 1] ?? null,
      fuelUsed: fuel.length > 1 ? Math.max(0, fuel[fuel.length - 1] - fuel[0]) : null,
    },
  };
}
