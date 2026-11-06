import "server-only";
import type { Scope } from "./auth/session";
import { fleet } from "./flespi";
import type { VehicleState } from "./types";
import { parts, zoned } from "./tz";

export type Period = { km: number | null; hours: number | null; fuel: number | null };
export type MonthStats = { thisMonth: Period; lastMonth: Period };

const diff = (a: number | null | undefined, b: number | null | undefined) =>
  a != null && b != null && a >= b && a - b < 100000 ? a - b : null;

export function monthStarts(now = Date.now() / 1000): [number, number] {
  const p = parts(now);
  const thisStart = zoned(p.y, p.m, 1);
  const lastStart = p.m === 1 ? zoned(p.y - 1, 12, 1) : zoned(p.y, p.m - 1, 1);
  return [thisStart, lastStart];
}

/** Km, ore motore e litri di questo mese e del mese scorso, dai contatori del veicolo */
export async function monthStats(scope: Scope, v: VehicleState): Promise<MonthStats> {
  const [thisStart, lastStart] = monthStarts();
  const [a, b] = await Promise.all([
    fleet.countersAt(scope, v.id, lastStart).catch(() => null),
    fleet.countersAt(scope, v.id, thisStart).catch(() => null),
  ]);
  return {
    thisMonth: { km: diff(v.odometerKm, b?.odo), hours: diff(v.engineHours, b?.hours), fuel: diff(v.fuelUsed, b?.fuel) },
    lastMonth: { km: diff(b?.odo, a?.odo), hours: diff(b?.hours, a?.hours), fuel: diff(b?.fuel, a?.fuel) },
  };
}
