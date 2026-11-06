import type { TrackPoint } from "./types";
import { haversineKm } from "./format";

export type Trip = { startIdx: number; endIdx: number; start: number; end: number; km: number; maxSpeed: number };
export type TrackSummary = { km: number; drivingS: number; maxSpeed: number; avgSpeed: number; trips: Trip[]; stops: number };

const MOVING_KMH = 3;
const MIN_STOP_S = 5 * 60; // una sosta più lunga di 5 minuti chiude il viaggio
const MAX_JUMP_KM = 50; // scarta salti GPS anomali

/** Calcolo lato browser di distanza, tempi e viaggi a partire dai punti grezzi */
export function summarize(points: TrackPoint[]): TrackSummary {
  let km = 0, drivingS = 0, maxSpeed = 0;
  const trips: Trip[] = [];
  let cur: Trip | null = null;
  let stillSince: number | null = null;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1];
    const moving = (p.speed ?? 0) > MOVING_KMH;
    let d = 0;
    if (prev) {
      d = haversineKm([prev.lat, prev.lon], [p.lat, p.lon]);
      if (d > MAX_JUMP_KM) d = 0;
      km += d;
      if (moving || (prev.speed ?? 0) > MOVING_KMH) drivingS += Math.min(p.ts - prev.ts, 600);
    }
    maxSpeed = Math.max(maxSpeed, p.speed ?? 0);

    if (moving) {
      stillSince = null;
      if (!cur) cur = { startIdx: Math.max(0, i - 1), endIdx: i, start: (prev ?? p).ts, end: p.ts, km: 0, maxSpeed: 0 };
      cur.endIdx = i; cur.end = p.ts; cur.km += d; cur.maxSpeed = Math.max(cur.maxSpeed, p.speed ?? 0);
    } else if (cur) {
      cur.km += d;
      stillSince ??= p.ts;
      if (p.ts - stillSince >= MIN_STOP_S) { trips.push(cur); cur = null; }
    }
  }
  if (cur) trips.push(cur);
  const realTrips = trips.filter((t) => t.km >= 0.3);
  return {
    km, drivingS, maxSpeed,
    avgSpeed: drivingS > 0 ? km / (drivingS / 3600) : 0,
    trips: realTrips,
    stops: Math.max(0, realTrips.length - 1),
  };
}
