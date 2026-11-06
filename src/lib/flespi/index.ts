import "server-only";
import { inArray } from "drizzle-orm";
import { isMock } from "../env";
import { getDb, schema } from "../db";
import type { TrackPoint, VehicleDetail, VehicleState } from "../types";
import type { Scope } from "../auth/session";
import * as real from "./client";
import * as mock from "./mock";

/** Sorgente dati: flespi reale oppure simulazione (modalità demo) */
const base = isMock ? mock : real;

async function profilesFor(ids: number[]) {
  if (!ids.length) return { profiles: new Map<number, schema.VehicleProfile>(), drivers: new Map<number, string>() };
  try {
    const db = await getDb();
    const rows = await db.select().from(schema.vehicles).where(inArray(schema.vehicles.deviceId, ids));
    const driverIds = rows.map((r) => r.driverId).filter((x): x is number => x != null);
    const ds = driverIds.length ? await db.select({ id: schema.drivers.id, name: schema.drivers.name }).from(schema.drivers).where(inArray(schema.drivers.id, driverIds)) : [];
    return { profiles: new Map(rows.map((r) => [r.deviceId, r])), drivers: new Map(ds.map((d) => [d.id, d.name])) };
  } catch {
    return { profiles: new Map<number, schema.VehicleProfile>(), drivers: new Map<number, string>() };
  }
}

/**
 * Unisce ai dati di flespi l'anagrafica salvata nel nostro database:
 * - targa e modello diventano il nome visibile, tipo ed etichetta personalizzano la mappa;
 * - l'autista abbinato (sezione Autisti) o quello scritto a mano;
 * - carburante: con la capienza del serbatoio si ricavano i litri dalla % (o la % dai litri);
 * - contachilometri: si applica la correzione impostata nel profilo.
 */
export async function applyProfiles(list: VehicleState[]): Promise<VehicleState[]> {
  if (!list.length) return list;
  const { profiles, drivers } = await profilesFor(list.map((v) => v.id));
  return list.map((v) => {
    const p = profiles.get(v.id);
    const makeModel = p ? [p.make, p.model].filter(Boolean).join(" ") || null : null;
    const name = p?.plate || v.name;
    let { fuelLevel, fuelVolume } = v;
    let fuelFromTank = false;
    if (p?.tankL && p.tankL > 0) {
      if (fuelLevel != null && fuelVolume == null) { fuelVolume = (fuelLevel / 100) * p.tankL; fuelFromTank = true; }
      else if (fuelVolume != null && fuelLevel == null) { fuelLevel = Math.min(100, (fuelVolume / p.tankL) * 100); fuelFromTank = true; }
    }
    const offset = p?.odoOffsetKm ?? null;
    return {
      ...v,
      name,
      deviceName: v.name,
      plate: p?.plate ?? null,
      makeModel,
      vtype: p?.type ?? null,
      driverId: p?.driverId ?? null,
      driver: (p?.driverId != null ? drivers.get(p.driverId) : null) ?? p?.driver ?? null,
      label: p?.iconText || name,
      unavailable: p?.unavailable ?? false,
      speedLimit: p?.speedLimit ?? null,
      fuelLevel,
      fuelVolume,
      fuelFromTank,
      odometerKm: v.odometerKm != null && offset ? v.odometerKm + offset : v.odometerKm,
      odoOffset: offset,
    };
  });
}

async function offsetOf(id: number) {
  const { profiles } = await profilesFor([id]);
  return profiles.get(id)?.odoOffsetKm ?? 0;
}

export const fleet = {
  ...base,
  async listVehicles(scope: Scope): Promise<VehicleState[]> {
    const list = await applyProfiles(await base.listVehicles(scope));
    return list.sort((a, b) => a.name.localeCompare(b.name, "it"));
  },
  async getVehicle(scope: Scope, id: number): Promise<VehicleDetail | null> {
    const d = await base.getVehicle(scope, id);
    if (!d) return null;
    const [state] = await applyProfiles([d.state]);
    return { ...d, state };
  },
  /** Percorso con il contachilometri già corretto, così report e itinerari coincidono con il profilo */
  async getTrack(scope: Scope, id: number, from: number, to: number): Promise<TrackPoint[] | null> {
    const pts = await base.getTrack(scope, id, from, to);
    if (!pts) return pts;
    const off = await offsetOf(id);
    return off ? pts.map((p) => (p.odometer != null ? { ...p, odometer: p.odometer + off } : p)) : pts;
  },
  async countersAt(scope: Scope, id: number, from: number) {
    const c = await base.countersAt(scope, id, from);
    if (!c) return c;
    const off = await offsetOf(id);
    return off && c.odo != null ? { ...c, odo: c.odo + off } : c;
  },
};

export { FlespiError } from "./client";
