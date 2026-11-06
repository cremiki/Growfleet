import "server-only";
import { env } from "../env";
import type { Scope } from "../auth/session";
import type { Subaccount, TelemetryEntry, TrackPoint, VehicleDetail, VehicleState } from "../types";
import { LIST_PARAMS, normalize, telemetryToEntries, type RawDevice } from "./normalize";

const BASE = "https://flespi.io";

export class FlespiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type FlespiResponse<T> = { result?: T[]; errors?: { reason?: string; code?: number }[] };

/**
 * Chiamata REST a flespi con il token del server.
 * Per i clienti aggiunge x-flespi-cid: flespi restituisce solo gli oggetti di quel subaccount.
 */
async function call<T>(
  path: string,
  opts: { scope?: Scope; method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T[]> {
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const headers: Record<string, string> = {
    Authorization: `FlespiToken ${env.flespiToken}`,
    Accept: "application/json",
  };
  if (opts.scope?.kind === "customer") headers["x-flespi-cid"] = String(opts.scope.cid);
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  let json: FlespiResponse<T> = {};
  try {
    json = (await res.json()) as FlespiResponse<T>;
  } catch {
    /* risposta vuota */
  }
  if (!res.ok || json.errors?.length) {
    const reason = json.errors?.map((e) => e.reason).filter(Boolean).join("; ");
    throw new FlespiError(reason || `flespi ha risposto ${res.status}`, res.status || 502);
  }
  return json.result ?? [];
}

const DEVICE_FIELDS = "id,name,cid,connected,last_active,configuration";

// Piccola cache in memoria: più schede aperte sulla mappa non moltiplicano le chiamate API
const cache = new Map<string, { at: number; data: VehicleState[] }>();
const CACHE_MS = 3000;

export async function listVehicles(scope: Scope): Promise<VehicleState[]> {
  const key = scope.kind === "all" ? "all" : `cid:${scope.cid}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const [devices, telemetry] = await Promise.all([
    call<RawDevice>("/gw/devices/all", { scope, query: { fields: DEVICE_FIELDS } }),
    call<{ id: number; telemetry?: Record<string, { value: unknown; ts: number }> }>(
      `/gw/devices/all/telemetry/${LIST_PARAMS.join(",")}`,
      { scope },
    ),
  ]);
  const byId = new Map(telemetry.map((t) => [t.id, t.telemetry ?? {}]));
  const data = devices
    .filter((d) => scope.kind === "all" || d.cid === undefined || d.cid === scope.cid)
    .map((d) => normalize(d, byId.get(d.id)))
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
  cache.set(key, { at: Date.now(), data });
  return data;
}

async function getDevice(scope: Scope, id: number): Promise<RawDevice | null> {
  try {
    const [d] = await call<RawDevice>(`/gw/devices/${id}`, { scope, query: { fields: DEVICE_FIELDS } });
    if (!d) return null;
    // Doppio controllo sul perimetro del cliente
    if (scope.kind === "customer" && d.cid !== undefined && d.cid !== scope.cid) return null;
    return d;
  } catch (e) {
    if (e instanceof FlespiError && (e.status === 403 || e.status === 404 || e.status === 400)) return null;
    throw e;
  }
}

export async function getVehicle(scope: Scope, id: number): Promise<VehicleDetail | null> {
  const dev = await getDevice(scope, id);
  if (!dev) return null;
  const [t] = await call<{ id: number; telemetry?: Record<string, { value: unknown; ts: number }> }>(
    `/gw/devices/${id}/telemetry/all`,
    { scope },
  );
  const tel = t?.telemetry ?? {};
  return { state: normalize(dev, tel), telemetry: telemetryToEntries(tel) as TelemetryEntry[] };
}

type RawMessage = {
  timestamp: number;
  "position.latitude"?: number;
  "position.longitude"?: number;
  "position.speed"?: number;
  "engine.ignition.status"?: boolean;
};

export async function getTrack(scope: Scope, id: number, from: number, to: number): Promise<TrackPoint[] | null> {
  const dev = await getDevice(scope, id);
  if (!dev) return null;
  const msgs = await call<RawMessage>(`/gw/devices/${id}/messages`, {
    scope,
    query: {
      data: JSON.stringify({
        from,
        to,
        fields: "timestamp,position.latitude,position.longitude,position.speed,engine.ignition.status",
      }),
    },
  });
  return msgs
    .filter((m) => typeof m["position.latitude"] === "number" && typeof m["position.longitude"] === "number")
    .map((m) => ({
      ts: m.timestamp,
      lat: m["position.latitude"]!,
      lon: m["position.longitude"]!,
      speed: m["position.speed"] ?? null,
      ignition: m["engine.ignition.status"] ?? null,
    }));
}

/** Subaccount flespi (richiede token Master) */
export async function listSubaccounts(): Promise<Subaccount[]> {
  const r = await call<{ id: number; name: string }>("/platform/subaccounts/all", { query: { fields: "id,name" } });
  return r.map((s) => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name, "it"));
}

export async function createSubaccount(name: string): Promise<Subaccount> {
  const [s] = await call<{ id: number; name: string }>("/platform/subaccounts", {
    method: "POST",
    body: [{ name }],
  });
  if (!s) throw new FlespiError("flespi non ha restituito il subaccount creato", 502);
  return { id: s.id, name: s.name };
}
