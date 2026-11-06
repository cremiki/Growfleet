import "server-only";
import { env } from "../env";
import type { Scope } from "../auth/session";
import type { DeviceSummary, TelemetryEntry, TrackPoint, VehicleDetail, VehicleState } from "../types";
import { LIST_PARAMS, normalize, PARAMS, telemetryToEntries, type RawDevice } from "./normalize";
import { buildDiagnosis, type Diagnosis } from "./diagnose";

const BASE = "https://flespi.io";

export class FlespiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type FlespiResponse<T> = { result?: T[]; errors?: { reason?: string; code?: number }[] };
type RawTelemetry = { id: number; telemetry?: Record<string, { value: unknown; ts: number }> };

/** Chiamata REST a flespi con il token del server (il browser non lo vede mai) */
async function call<T>(
  path: string,
  opts: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T[]> {
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const headers: Record<string, string> = {
    Authorization: `FlespiToken ${env.flespiToken}`,
    Accept: "application/json",
  };
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

/** Selettore REST flespi per il perimetro: "all" oppure l'elenco di ID assegnati */
function selector(scope: Scope): string | null {
  if (scope.kind === "all") return "all";
  return scope.deviceIds.length ? scope.deviceIds.join(",") : null;
}
const allowed = (scope: Scope, id: number) => scope.kind === "all" || scope.deviceIds.includes(id);

// Piccola cache in memoria: più schede aperte sulla mappa non moltiplicano le chiamate API
const cache = new Map<string, { at: number; data: VehicleState[] }>();
const CACHE_MS = 3000;

export async function listVehicles(scope: Scope): Promise<VehicleState[]> {
  const sel = selector(scope);
  if (!sel) return [];
  const hit = cache.get(sel);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const [devices, telemetry] = await Promise.all([
    call<RawDevice>(`/gw/devices/${sel}`, { query: { fields: DEVICE_FIELDS } }),
    call<RawTelemetry>(`/gw/devices/${sel}/telemetry/${LIST_PARAMS.join(",")}`),
  ]);
  const byId = new Map(telemetry.map((t) => [t.id, t.telemetry ?? {}]));
  const data = devices
    .filter((d) => allowed(scope, d.id))
    .map((d) => normalize(d, byId.get(d.id)))
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
  cache.set(sel, { at: Date.now(), data });
  return data;
}

async function getDevice(scope: Scope, id: number): Promise<RawDevice | null> {
  if (!allowed(scope, id)) return null;
  try {
    const [d] = await call<RawDevice>(`/gw/devices/${id}`, { query: { fields: DEVICE_FIELDS } });
    return d ?? null;
  } catch (e) {
    if (e instanceof FlespiError && [400, 403, 404].includes(e.status)) return null;
    throw e;
  }
}

export async function getVehicle(scope: Scope, id: number): Promise<VehicleDetail | null> {
  const dev = await getDevice(scope, id);
  if (!dev) return null;
  const [t] = await call<RawTelemetry>(`/gw/devices/${id}/telemetry/all`);
  const tel = t?.telemetry ?? {};
  return { state: normalize(dev, tel), telemetry: telemetryToEntries(tel) as TelemetryEntry[] };
}

type RawMessage = {
  timestamp: number;
  [k: string]: unknown;
};
const firstNum = (m: RawMessage, names: readonly string[]) => {
  for (const n of names) if (typeof m[n] === "number") return m[n] as number;
  return null;
};

export async function getTrack(scope: Scope, id: number, from: number, to: number): Promise<TrackPoint[] | null> {
  const dev = await getDevice(scope, id);
  if (!dev) return null;
  const msgs = await call<RawMessage>(`/gw/devices/${id}/messages`, {
    query: {
      data: JSON.stringify({
        from,
        to,
        fields: ["timestamp", "position.latitude", "position.longitude", "position.speed", "engine.ignition.status",
          ...PARAMS.odometerKm, ...PARAMS.fuelUsed, ...PARAMS.externalV].join(","),
      }),
    },
  });
  return msgs
    .filter((m) => typeof m["position.latitude"] === "number" && typeof m["position.longitude"] === "number")
    .map((m) => ({
      ts: m.timestamp,
      lat: m["position.latitude"] as number,
      lon: m["position.longitude"] as number,
      speed: typeof m["position.speed"] === "number" ? m["position.speed"] : null,
      ignition: typeof m["engine.ignition.status"] === "boolean" ? m["engine.ignition.status"] : null,
      odometer: firstNum(m, PARAMS.odometerKm),
      fuelUsed: firstNum(m, PARAMS.fuelUsed),
      voltage: firstNum(m, PARAMS.externalV),
    }));
}

export type Counters = { odo: number | null; hours: number | null; fuel: number | null };

/**
 * Valori dei contatori (contachilometri, ore motore, carburante consumato) al primo messaggio dopo `from`.
 * Basta leggere pochi messaggi: è il modo leggero per calcolare km, ore e litri di un mese.
 */
export async function countersAt(scope: Scope, id: number, from: number): Promise<Counters | null> {
  if (!allowed(scope, id)) return null;
  const msgs = await call<RawMessage>(`/gw/devices/${id}/messages`, {
    query: {
      data: JSON.stringify({
        from, to: Math.min(from + 40 * 86400, Math.floor(Date.now() / 1000)), count: 50,
        fields: ["timestamp", ...PARAMS.odometerKm, ...PARAMS.engineHours, ...PARAMS.fuelUsed].join(","),
      }),
    },
  });
  const first = (names: readonly string[]) => {
    for (const m of msgs) { const v = firstNum(m, names); if (v != null) return v; }
    return null;
  };
  return { odo: first(PARAMS.odometerKm), hours: first(PARAMS.engineHours), fuel: first(PARAMS.fuelUsed) };
}

/** Tutti i dispositivi visibili al token (per l'assegnazione ai clienti) */
export async function listDevices(): Promise<DeviceSummary[]> {
  const r = await call<RawDevice>("/gw/devices/all", { query: { fields: "id,name,configuration" } });
  return r
    .map((d) => ({ id: d.id, name: d.name || `Dispositivo ${d.id}`, ident: d.configuration?.ident ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
}

/** Verifica del token e dei dati disponibili, per la pagina Collegamento flespi */
export async function diagnose(): Promise<Diagnosis> {
  const attempt = async <T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string; status: number }> => {
    try {
      return { ok: true, value: await fn() };
    } catch (e) {
      return { ok: false, error: (e as Error).message, status: e instanceof FlespiError ? e.status : 0 };
    }
  };
  if (!env.flespiToken) return buildDiagnosis({ configured: false });

  const info = await attempt(() => call<Record<string, unknown>>("/auth/info"));
  const platform = await attempt(() => call("/platform/customer"));
  const devices = await attempt(() =>
    call<RawDevice & { messages_ttl?: number }>("/gw/devices/all", { query: { fields: `${DEVICE_FIELDS},messages_ttl` } }));
  const telemetry = await attempt(() => call<RawTelemetry>("/gw/devices/all/telemetry/all"));

  let messages: Awaited<ReturnType<typeof attempt<unknown[]>>> | null = null;
  let messagesDevice: number | null = null;
  if (devices.ok && telemetry.ok) {
    // il dispositivo che ha inviato dati più di recente
    const lastTs = (t: RawTelemetry) => Math.max(0, ...Object.values(t.telemetry ?? {}).map((v) => v?.ts ?? 0));
    const withData = [...telemetry.value].filter((t) => lastTs(t) > 0).sort((x, y) => lastTs(y) - lastTs(x))[0];
    if (withData) {
      messagesDevice = withData.id;
      const now = Math.floor(Date.now() / 1000);
      messages = await attempt(() => call(`/gw/devices/${withData.id}/messages`, {
        query: { data: JSON.stringify({ from: now - 7 * 86400, to: now, fields: "timestamp", count: 1 }) },
      }));
    }
  }
  return buildDiagnosis({ configured: true, info, platform, devices, telemetry, messages, messagesDevice });
}
