import "server-only";
import type { Scope } from "../auth/session";
import type { DeviceSummary, TelemetryEntry, TrackPoint, VehicleDetail, VehicleState } from "../types";
import { computeStatus } from "./normalize";
import { coverage, type Diagnosis } from "./diagnose";

/**
 * Modalità demo: veicoli simulati con movimento deterministico.
 * Ogni veicolo percorre un anello attorno a una città: 40 minuti di marcia e 20 di sosta ogni ora.
 */
type Profile = "drive" | "idle" | "parked" | "offline";
type Def = {
  id: number; name: string; ident: string; cid: number;
  center: [number, number]; rx: number; ry: number; periodS: number; phase: number;
  profile: Profile; offset: number; odoBase: number;
};

const D: Def[] = [
  { id: 501, name: "FX 482 KL Iveco Daily", ident: "352093081234567", cid: 1001, center: [41.9, 12.49], rx: 0.07, ry: 0.045, periodS: 2400, phase: 0.1, profile: "drive", offset: 0, odoBase: 184230 },
  { id: 502, name: "GA 107 RT Fiat Ducato", ident: "352093081234568", cid: 1001, center: [41.87, 12.55], rx: 0.05, ry: 0.035, periodS: 1900, phase: 2.1, profile: "drive", offset: 1500, odoBase: 96410 },
  { id: 503, name: "EZ 930 PM Mercedes Sprinter", ident: "352093081234569", cid: 1001, center: [41.93, 12.44], rx: 0.04, ry: 0.03, periodS: 1600, phase: 4.0, profile: "idle", offset: 0, odoBase: 251880 },
  { id: 504, name: "FB 221 HS Renault Master", ident: "352093081234570", cid: 1001, center: [41.86, 12.47], rx: 0, ry: 0, periodS: 1, phase: 0, profile: "parked", offset: 0, odoBase: 143002 },
  { id: 505, name: "DY 618 ZA Ford Transit", ident: "352093081234571", cid: 1001, center: [41.95, 12.52], rx: 0, ry: 0, periodS: 1, phase: 0, profile: "offline", offset: 0, odoBase: 312775 },
  { id: 601, name: "GD 554 LV Scania R450", ident: "864636060123401", cid: 1002, center: [45.46, 9.19], rx: 0.11, ry: 0.07, periodS: 3600, phase: 1.3, profile: "drive", offset: 700, odoBase: 612340 },
  { id: 602, name: "FN 309 CE Volvo FH", ident: "864636060123402", cid: 1002, center: [44.49, 11.34], rx: 0.09, ry: 0.06, periodS: 3000, phase: 3.3, profile: "drive", offset: 2100, odoBase: 488120 },
  { id: 603, name: "GC 771 BB DAF XF", ident: "864636060123403", cid: 1002, center: [45.07, 7.68], rx: 0.08, ry: 0.05, periodS: 2800, phase: 5.2, profile: "drive", offset: 3000, odoBase: 377905 },
  { id: 604, name: "EV 045 TT Iveco S-Way", ident: "864636060123404", cid: 1002, center: [43.77, 11.25], rx: 0, ry: 0, periodS: 1, phase: 0, profile: "parked", offset: 0, odoBase: 701250 },
];

const CYCLE = 3600;
const DRIVE = 2400;

const EPOCH = 1_760_000_000; // ottobre 2025: base della simulazione

function driveSeconds(d: Def, t: number) {
  const x = t - EPOCH + d.offset;
  const k = Math.floor(x / CYCLE);
  const r = x - k * CYCLE;
  return { total: k * DRIVE + Math.min(r, DRIVE), driving: r < DRIVE };
}

function posAt(d: Def, t: number): [number, number] {
  if (d.profile !== "drive" && d.profile !== "idle") return d.center;
  const { total } = driveSeconds(d, d.profile === "idle" ? EPOCH + 5000 : t);
  const th = (2 * Math.PI * total) / d.periodS + d.phase;
  return [
    d.center[0] + d.ry * Math.sin(th) + d.ry * 0.18 * Math.sin(3 * th),
    d.center[1] + d.rx * Math.cos(th) + d.rx * 0.12 * Math.cos(5 * th),
  ];
}

function distKm(a: [number, number], b: [number, number]) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function sampleAt(d: Def, t: number) {
  const driving = d.profile === "drive" && driveSeconds(d, t).driving;
  const p = posAt(d, t);
  let speed = 0, course = 0;
  if (driving) {
    const q = posAt(d, t + 5);
    speed = Math.round((distKm(p, q) / 5) * 3600);
    course = Math.round(((Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI + 360) % 360);
  }
  const ds = d.profile === "drive" ? driveSeconds(d, t).total : 0;
  const km = ds * 0.0139;
  return {
    p, speed, course, driving,
    ignition: driving || d.profile === "idle",
    odometer: Math.round((d.odoBase + km) * 10) / 10,
    fuel: Math.round(18 + 70 * (1 - (km % 650) / 650)),
  };
}

function state(d: Def, now: number): VehicleState {
  const t = d.profile === "offline" ? now - 5 * 3600 - 1240 : now;
  const s = sampleAt(d, t);
  const base = {
    id: d.id, name: d.name, ident: d.ident, cid: d.cid,
    connected: d.profile !== "offline",
    lastSeen: d.profile === "parked" ? now - 140 : t - 8,
    lat: s.p[0], lon: s.p[1], speed: s.speed, course: s.course,
    satellites: d.profile === "offline" ? 4 : 11,
    positionTs: t - 8,
    ignition: s.ignition, movement: s.driving,
    fuelLevel: s.fuel, fuelVolume: Math.round(s.fuel * (d.cid === 1002 ? 6 : 0.9)),
    odometerKm: s.odometer, engineHours: Math.round(d.odoBase / 42 + (d.profile === "drive" ? (s.odometer - d.odoBase) / 50 : 0)),
    fuelUsed: Math.round(s.odometer * 0.075 * 10) / 10, gpsMileage: Math.round(s.odometer * 0.31 * 10) / 10,
    batteryV: 4.1, externalV: s.ignition ? 27.9 : 24.6, gsmSignal: 78,
  };
  return { ...base, status: computeStatus(base, now) };
}

const now = () => Math.floor(Date.now() / 1000);
const inScope = (scope: Scope, d: Def) => scope.kind === "all" || scope.deviceIds.includes(d.id);

export async function listVehicles(scope: Scope): Promise<VehicleState[]> {
  const n = now();
  return D.filter((d) => inScope(scope, d)).map((d) => state(d, n)).sort((a, b) => a.name.localeCompare(b.name, "it"));
}

export async function getVehicle(scope: Scope, id: number): Promise<VehicleDetail | null> {
  const d = D.find((x) => x.id === id && inScope(scope, x));
  if (!d) return null;
  const st = state(d, now());
  const ts = st.positionTs ?? now();
  const tel: TelemetryEntry[] = [
    ["battery.voltage", st.batteryV], ["can.fuel.level", st.fuelLevel], ["can.fuel.volume", st.fuelVolume],
    ["can.vehicle.mileage", st.odometerKm], ["can.engine.motorhours", st.engineHours],
    ["can.fuel.consumed", st.fuelUsed], ["vehicle.mileage", st.gpsMileage], ["ambient.air.temperature", 14],
    ["device.type.id", 742], ["engine.ignition.status", st.ignition], ["external.powersource.voltage", st.externalV],
    ["gsm.signal.level", st.gsmSignal], ["ident", st.ident], ["movement.status", st.movement],
    ["position.altitude", 38], ["position.direction", st.course], ["position.latitude", st.lat],
    ["position.longitude", st.lon], ["position.satellites", st.satellites], ["position.speed", st.speed],
    ["position.valid", true], ["timestamp", ts],
  ].map(([name, value]) => ({ name: name as string, value, ts }));
  return { state: st, telemetry: tel };
}

export async function getTrack(scope: Scope, id: number, from: number, to: number): Promise<TrackPoint[] | null> {
  const d = D.find((x) => x.id === id && inScope(scope, x));
  if (!d) return null;
  if (d.profile !== "drive") {
    // veicoli fermi: un messaggio ogni 15 minuti (quello offline smette di trasmettere 5 ore fa)
    const last = d.profile === "offline" ? now() - 5 * 3600 - 1240 : now();
    const pts: TrackPoint[] = [];
    const p = posAt(d, from);
    for (let t = Math.ceil(from / 900) * 900; t <= Math.min(to, last); t += 900) {
      const on = d.profile === "idle";
      pts.push({ ts: t, lat: p[0], lon: p[1], speed: 0, ignition: on, odometer: d.odoBase, fuelUsed: Math.round(d.odoBase * 0.075 * 10) / 10, voltage: on ? 27.6 : 24.4 });
    }
    return pts;
  }
  const out: TrackPoint[] = [];
  const end = Math.min(to, now());
  for (let t = from; t <= end; t += 30) {
    const s = sampleAt(d, t);
    // da fermo il tracker invia meno spesso
    if (!s.driving && t % 300 >= 30) continue;
    out.push({ ts: t, lat: s.p[0], lon: s.p[1], speed: s.speed, ignition: s.ignition,
      odometer: s.odometer, fuelUsed: Math.round(s.odometer * 0.075 * 10) / 10,
      // tensione simulata, con un'interruzione di alimentazione ogni tanto
      voltage: (t % 86400) > 7200 && (t % 86400) < 7500 ? 0 : s.ignition ? 27.8 : 24.5 });
  }
  return out;
}

export async function countersAt(scope: Scope, id: number, from: number) {
  const d = D.find((x) => x.id === id && inScope(scope, x));
  if (!d) return null;
  if (d.profile !== "drive") return { odo: d.odoBase, hours: Math.round(d.odoBase / 42), fuel: Math.round(d.odoBase * 0.075 * 10) / 10 };
  const s = sampleAt(d, from);
  return { odo: s.odometer, hours: Math.round(d.odoBase / 42 + (s.odometer - d.odoBase) / 50), fuel: Math.round(s.odometer * 0.075 * 10) / 10 };
}

export async function listDevices(): Promise<DeviceSummary[]> {
  return D.map((d) => ({ id: d.id, name: d.name, ident: d.ident })).sort((a, b) => a.name.localeCompare(b.name, "it"));
}

export async function diagnose(): Promise<Diagnosis> {
  const devices = await Promise.all(D.map(async (d) => {
    const v = await getVehicle({ kind: "all" }, d.id);
    const tel = Object.fromEntries((v?.telemetry ?? []).map((t) => [t.name, { value: t.value, ts: t.ts }]));
    return coverage({ id: d.id, name: d.name, configuration: { ident: d.ident }, messages_ttl: 31536000 }, tel);
  }));
  return {
    mock: true,
    configured: false,
    tokenInfo: null,
    devices,
    checks: [{ title: "Modalità demo", status: "warn", detail: "FLESPI_TOKEN non è impostato: stai vedendo veicoli simulati. Aggiungi il token nelle variabili d'ambiente di Vercel e ripubblica." }],
  };
}
