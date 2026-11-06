import type { TelemetryEntry, VehicleState, VehicleStatus } from "../types";

/**
 * Nomi dei parametri flespi da cui ricavare lo stato del veicolo.
 * Per ogni grandezza si prende il primo parametro presente: i nomi cambiano
 * in base al protocollo del dispositivo (es. dati CAN vs ingressi del tracker).
 * Aggiungi qui gli alias dei tuoi dispositivi se servono.
 */
export const PARAMS = {
  lat: ["position.latitude"],
  lon: ["position.longitude"],
  speed: ["position.speed"],
  course: ["position.direction"],
  satellites: ["position.satellites"],
  ignition: ["engine.ignition.status"],
  movement: ["movement.status"],
  fuelLevel: ["can.fuel.level", "fuel.level"],
  fuelVolume: ["can.fuel.volume", "fuel.volume"],
  odometerKm: ["can.vehicle.mileage", "vehicle.mileage"],
  engineHours: ["can.engine.motorhours", "engine.motorhours"],
  batteryV: ["battery.voltage"],
  externalV: ["external.powersource.voltage"],
  gsmSignal: ["gsm.signal.level"],
  timestamp: ["timestamp"],
} as const;

export const LIST_PARAMS: string[] = Array.from(new Set(Object.values(PARAMS).flat()));

/** Dopo quanto tempo senza messaggi un veicolo è considerato non raggiungibile */
export const OFFLINE_AFTER_S = 30 * 60;

type Telemetry = Record<string, { value: unknown; ts: number } | undefined>;

function pick(t: Telemetry, names: readonly string[]) {
  for (const n of names) if (t[n] !== undefined && t[n]!.value !== null) return t[n]!;
  return undefined;
}
const num = (t: Telemetry, names: readonly string[]) => {
  const v = pick(t, names)?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};
const bool = (t: Telemetry, names: readonly string[]) => {
  const v = pick(t, names)?.value;
  return typeof v === "boolean" ? v : typeof v === "number" ? v !== 0 : null;
};

export function computeStatus(s: Omit<VehicleState, "status">, now = Date.now() / 1000): VehicleStatus {
  if (s.lat === null || s.lon === null) return "nodata";
  if (!s.lastSeen || now - s.lastSeen > OFFLINE_AFTER_S) return "offline";
  if ((s.speed ?? 0) > 3 || (s.movement === true && (s.speed ?? 0) > 0)) return "moving";
  if (s.ignition) return "idle";
  return "stopped";
}

export type RawDevice = {
  id: number;
  name?: string;
  cid?: number;
  connected?: boolean;
  last_active?: number;
  configuration?: { ident?: string } | null;
};

export function normalize(dev: RawDevice, t: Telemetry = {}): VehicleState {
  const lastTs = Math.max(
    t["timestamp"]?.ts ?? 0,
    t["position.latitude"]?.ts ?? 0,
    dev.last_active ?? 0,
  );
  const base: Omit<VehicleState, "status"> = {
    id: dev.id,
    name: dev.name || `Dispositivo ${dev.id}`,
    ident: dev.configuration?.ident ?? "",
    cid: dev.cid ?? null,
    connected: !!dev.connected,
    lastSeen: lastTs || null,
    lat: num(t, PARAMS.lat),
    lon: num(t, PARAMS.lon),
    speed: num(t, PARAMS.speed),
    course: num(t, PARAMS.course),
    satellites: num(t, PARAMS.satellites),
    positionTs: t["position.latitude"]?.ts ?? null,
    ignition: bool(t, PARAMS.ignition),
    movement: bool(t, PARAMS.movement),
    fuelLevel: num(t, PARAMS.fuelLevel),
    fuelVolume: num(t, PARAMS.fuelVolume),
    odometerKm: num(t, PARAMS.odometerKm),
    engineHours: num(t, PARAMS.engineHours),
    batteryV: num(t, PARAMS.batteryV),
    externalV: num(t, PARAMS.externalV),
    gsmSignal: num(t, PARAMS.gsmSignal),
  };
  return { ...base, status: computeStatus(base) };
}

export function telemetryToEntries(t: Telemetry): TelemetryEntry[] {
  return Object.entries(t)
    .filter(([name, v]) => v && name !== "position") // "position" è un parametro virtuale aggregato
    .map(([name, v]) => ({ name, value: v!.value, ts: v!.ts }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
