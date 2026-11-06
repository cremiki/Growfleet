import "server-only";
import { inArray } from "drizzle-orm";
import { isMock } from "../env";
import { getDb, schema } from "../db";
import type { VehicleDetail, VehicleState } from "../types";
import type { Scope } from "../auth/session";
import * as real from "./client";
import * as mock from "./mock";

/** Sorgente dati: flespi reale oppure simulazione (modalità demo) */
const base = isMock ? mock : real;

/**
 * Unisce ai dati di flespi l'anagrafica salvata nel nostro database:
 * targa e modello diventano il nome visibile, tipo e limiti personalizzano mappa e report.
 */
export async function applyProfiles(list: VehicleState[]): Promise<VehicleState[]> {
  if (!list.length) return list;
  let rows: schema.VehicleProfile[] = [];
  try {
    const db = await getDb();
    rows = await db.select().from(schema.vehicles).where(inArray(schema.vehicles.deviceId, list.map((v) => v.id)));
  } catch {
    return list; // senza database si mostrano i nomi di flespi
  }
  const byId = new Map(rows.map((r) => [r.deviceId, r]));
  return list.map((v) => {
    const p = byId.get(v.id);
    const makeModel = p ? [p.make, p.model].filter(Boolean).join(" ") || null : null;
    const name = p?.plate || v.name;
    return {
      ...v,
      name,
      deviceName: v.name,
      plate: p?.plate ?? null,
      makeModel,
      vtype: p?.type ?? null,
      driver: p?.driver ?? null,
      label: p?.iconText || name,
      unavailable: p?.unavailable ?? false,
      speedLimit: p?.speedLimit ?? null,
    };
  });
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
};

export { FlespiError } from "./client";
