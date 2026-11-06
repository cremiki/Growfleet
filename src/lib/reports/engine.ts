import "server-only";
import type { Scope } from "../auth/session";
import { fleet } from "../flespi";
import type { TrackPoint, VehicleState } from "../types";
import { buildTimeline } from "../trips";
import { haversineKm } from "../format";
import { dateLabel, days, minuteOfDay, monthRange, parts } from "../tz";
import type { Column, Group, ReportInput, ReportResult, Row } from "./types";

export class ReportError extends Error {}

const MAX_PERIOD_S = 31 * 86400;
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

type Ctx = { scope: Scope; input: ReportInput; vehicles: VehicleState[] };

/* ---------------------------------------------------------------- utilità */

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

async function tracks(ctx: Ctx, from: number, to: number) {
  return pool(ctx.vehicles, 3, async (v) => ({ v, pts: (await fleet.getTrack(ctx.scope, v.id, from, to)) ?? [] }));
}

function period(input: ReportInput): [number, number] {
  const { from, to } = input;
  if (!from || !to || to <= from) throw new ReportError("Scegli un periodo valido: la fine deve essere dopo l'inizio.");
  if (to - from > MAX_PERIOD_S + 3600) throw new ReportError("Il periodo massimo è di 31 giorni.");
  return [from, Math.min(to, Math.floor(Date.now() / 1000))];
}

function month(input: ReportInput): [number, number, number, string] {
  if (!input.month || !/^\d{4}-\d{2}$/.test(input.month)) throw new ReportError("Scegli il mese.");
  const [from, to, n] = monthRange(input.month);
  return [from, to, n, input.month];
}

function inWindow(input: ReportInput) {
  if (!input.timeFrom || !input.timeTo) return () => true;
  const [a, b] = [input.timeFrom, input.timeTo].map((s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; });
  return (ts: number) => { const x = minuteOfDay(ts); return a <= b ? x >= a && x <= b : x >= a || x <= b; };
}

const place = (p: TrackPoint | undefined) => (p ? { lat: p.lat, lon: p.lon } : null);
const sum = (rows: Row[], key: string) => rows.reduce((s, r) => s + (typeof r[key] === "number" ? (r[key] as number) : 0), 0);
const maxOf = (rows: Row[], key: string) => rows.reduce((s, r) => Math.max(s, typeof r[key] === "number" ? (r[key] as number) : 0), 0);

function dayKm(pts: TrackPoint[], a: number, b: number) {
  const tl = buildTimeline(pts, a, b);
  const s = tl.summary;
  const odo = s.odoStart != null && s.odoEnd != null && s.odoEnd >= s.odoStart && s.odoEnd - s.odoStart < 3000 ? s.odoEnd - s.odoStart : null;
  return { gps: s.km, odo, tl };
}

function ignitionSeconds(pts: TrackPoint[], a: number, b: number) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    if (q.ts <= a || p.ts >= b || !p.ignition) continue;
    s += Math.min(Math.min(q.ts, b) - Math.max(p.ts, a), 15 * 60);
  }
  return s;
}

/* ---------------------------------------------------------------- report */

async function itinerari(ctx: Ctx): Promise<ReportResult> {
  const [from, to] = period(ctx.input);
  const ok = inWindow(ctx.input);
  const columns: Column[] = [
    { key: "date", label: "Data", kind: "date" },
    { key: "start", label: "Partenza", kind: "time" },
    { key: "fromPlace", label: "Da", kind: "address" },
    { key: "end", label: "Arrivo", kind: "time" },
    { key: "toPlace", label: "A", kind: "address" },
    { key: "km", label: "Distanza", kind: "km" },
    { key: "dur", label: "Tempo", kind: "dur" },
    { key: "vmax", label: "Velocità massima", kind: "speed", optional: true },
    { key: "vavg", label: "Velocità media", kind: "speed", optional: true },
  ];
  const groups: Group[] = [];
  for (const { v, pts } of await tracks(ctx, from, to)) {
    const rows: Row[] = [];
    for (const [a, b] of days(from, to)) {
      const dp = pts.filter((p) => p.ts >= a && p.ts <= b);
      for (const it of buildTimeline(dp, a, b).items) {
        if (it.kind !== "trip" || !ok(it.start)) continue;
        const d = it.end - it.start;
        rows.push({
          date: a, start: it.start, fromPlace: place(dp[it.startIdx]), end: it.end, toPlace: place(dp[it.endIdx]),
          km: it.km, dur: d, vmax: it.maxSpeed || null, vavg: d > 60 ? it.km / (d / 3600) : null,
        });
      }
    }
    if (rows.length) groups.push({ title: v.name, rows, totals: { km: sum(rows, "km"), dur: sum(rows, "dur"), vmax: maxOf(rows, "vmax") } });
  }
  const all = groups.flatMap((g) => g.rows);
  return { columns, groups, totals: { km: sum(all, "km"), dur: sum(all, "dur"), vmax: maxOf(all, "vmax") } };
}

async function monthly(ctx: Ctx, metric: "km" | "hours" | "ignition"): Promise<ReportResult> {
  const [from, to, n] = month(ctx.input);
  const end = Math.min(to, Math.floor(Date.now() / 1000));
  const ds = days(from, to);
  const kind = metric === "km" ? "km" : "hours";
  const columns: Column[] = [
    { key: "vehicle", label: "Veicolo", kind: "text" },
    ...ds.slice(0, n).map(([a], i) => {
      const wd = parts(a + 43200).wd;
      return { key: `d${i + 1}`, label: `${i + 1} ${DAY_NAMES[wd]}`, kind, weekend: wd === 0 || wd === 6, compact: true } as Column;
    }),
    { key: "total", label: "Totale", kind, compact: true },
  ];
  const rows: Row[] = [];
  for (const { v, pts } of await tracks(ctx, from, end)) {
    const row: Row = { vehicle: v.name };
    let tot = 0;
    ds.slice(0, n).forEach(([a, b], i) => {
      if (a > end) { row[`d${i + 1}`] = null; return; }
      const dp = pts.filter((p) => p.ts >= a - 1 && p.ts <= b);
      let val: number;
      if (metric === "km") { const k = dayKm(dp, a, Math.min(b, end)); val = k.odo ?? k.gps; }
      else if (metric === "hours") val = dayKm(dp, a, Math.min(b, end)).tl.summary.movingS;
      else val = ignitionSeconds(pts, a, Math.min(b, end));
      row[`d${i + 1}`] = val;
      tot += val;
    });
    row.total = tot;
    rows.push(row);
  }
  const totals: Row = { vehicle: "Totale" };
  for (const c of columns.slice(1)) totals[c.key] = rows.every((r) => r[c.key] == null) ? null : sum(rows, c.key);
  const notes = metric === "km" ? ["Quando il veicolo invia il contachilometri si usa quello, altrimenti la distanza calcolata dal GPS."] : undefined;
  return { columns, groups: [{ title: "", rows }], totals, notes };
}

async function gpsVsCan(ctx: Ctx): Promise<ReportResult> {
  const [from, to, n] = month(ctx.input);
  const end = Math.min(to, Math.floor(Date.now() / 1000));
  const ds = days(from, to).slice(0, n);
  const columns: Column[] = [
    { key: "vehicle", label: "Veicolo", kind: "text" },
    { key: "src", label: "Fonte", kind: "text" },
    ...ds.map(([a], i) => { const wd = parts(a + 43200).wd; return { key: `d${i + 1}`, label: `${i + 1} ${DAY_NAMES[wd]}`, kind: "km", weekend: wd === 0 || wd === 6, compact: true } as Column; }),
    { key: "total", label: "Totale", kind: "km", compact: true },
  ];
  const rows: Row[] = [];
  for (const { v, pts } of await tracks(ctx, from, end)) {
    const g: Row = { vehicle: v.name, src: "GPS" }, c: Row = { vehicle: "", src: "Contachilometri" };
    let tg = 0, tc = 0, hasCan = false;
    ds.forEach(([a, b], i) => {
      if (a > end) { g[`d${i + 1}`] = null; c[`d${i + 1}`] = null; return; }
      const k = dayKm(pts.filter((p) => p.ts >= a - 1 && p.ts <= b), a, Math.min(b, end));
      g[`d${i + 1}`] = k.gps; tg += k.gps;
      c[`d${i + 1}`] = k.odo; if (k.odo != null) { tc += k.odo; hasCan = true; }
    });
    g.total = tg; c.total = hasCan ? tc : null;
    rows.push(g, c);
  }
  return { columns, groups: [{ title: "", rows }], notes: ["La riga Contachilometri resta vuota se il veicolo non invia il contachilometri (CAN o tracker)."] };
}

async function fermate(ctx: Ctx): Promise<ReportResult> {
  const [from, to] = period(ctx.input);
  const minS = Math.max(1, ctx.input.minStop ?? 5) * 60;
  const columns: Column[] = [
    { key: "n", label: "N.", kind: "int" },
    { key: "start", label: "Inizio", kind: "datetime" },
    { key: "end", label: "Fine", kind: "datetime" },
    { key: "dur", label: "Durata", kind: "dur" },
    { key: "where", label: "Luogo", kind: "address" },
    { key: "coords", label: "Coordinate", kind: "coords", optional: true },
  ];
  const groups: Group[] = [];
  for (const { v, pts } of await tracks(ctx, from, to)) {
    const rows: Row[] = [];
    for (const it of buildTimeline(pts, from, to).items) {
      if (it.kind !== "stop" || it.end - it.start < minS) continue;
      rows.push({ n: rows.length + 1, start: it.start, end: it.end, dur: it.end - it.start, where: { lat: it.lat, lon: it.lon }, coords: { lat: it.lat, lon: it.lon } });
    }
    if (rows.length) groups.push({ title: v.name, rows, totals: { dur: sum(rows, "dur") } });
  }
  return { columns, groups, notes: [`Fermate di almeno ${minS / 60} minuti.`] };
}

async function coordinate(ctx: Ctx): Promise<ReportResult> {
  const [from, to] = period(ctx.input);
  if (ctx.vehicles.length !== 1) throw new ReportError("Scegli un solo veicolo per questo report.");
  const ok = inWindow(ctx.input);
  const [{ v, pts }] = await tracks(ctx, from, to);
  const sel = pts.filter((p) => ok(p.ts));
  const LIMIT = 5000;
  const columns: Column[] = [
    { key: "ts", label: "Data e ora", kind: "datetime" },
    { key: "coords", label: "Coordinate", kind: "coords" },
    { key: "speed", label: "Velocità", kind: "speed" },
    { key: "ign", label: "Quadro", kind: "onoff" },
    { key: "odo", label: "Contachilometri", kind: "km", optional: true },
  ];
  const rows = sel.slice(0, LIMIT).map((p) => ({ ts: p.ts, coords: { lat: p.lat, lon: p.lon }, speed: p.speed, ign: p.ignition, odo: p.odometer }));
  return {
    columns, groups: [{ title: v.name, rows }],
    notes: sel.length > LIMIT ? [`Mostrate le prime ${LIMIT} posizioni su ${sel.length}: restringi il periodo per vederle tutte.`] : undefined,
  };
}

async function posizionamento(ctx: Ctx): Promise<ReportResult> {
  const at = ctx.input.at;
  if (!at) throw new ReportError("Scegli data e ora.");
  const columns: Column[] = [
    { key: "vehicle", label: "Veicolo", kind: "text" },
    { key: "ts", label: "Posizione delle", kind: "datetime" },
    { key: "where", label: "Luogo", kind: "address" },
    { key: "coords", label: "Coordinate", kind: "coords", optional: true },
    { key: "speed", label: "Velocità", kind: "speed" },
    { key: "ign", label: "Quadro", kind: "onoff" },
  ];
  const rows: Row[] = [];
  for (const { v, pts } of await tracks(ctx, at - 2 * 86400, at)) {
    const p = pts[pts.length - 1];
    rows.push(p
      ? { vehicle: v.name, ts: p.ts, where: place(p), coords: place(p), speed: p.speed, ign: p.ignition }
      : { vehicle: v.name, ts: null, where: null, coords: null, speed: null, ign: null });
  }
  return { columns, groups: [{ title: "", rows }], notes: ["Ultima posizione nota prima dell'istante scelto (fino a 48 ore prima)."] };
}

async function tensione(ctx: Ctx): Promise<ReportResult> {
  const [from, to] = period(ctx.input);
  const LOW = 6; // sotto questa tensione l'alimentazione esterna è considerata assente
  const columns: Column[] = [
    { key: "vehicle", label: "Veicolo", kind: "text" },
    { key: "vmin", label: "Minima", kind: "volt" },
    { key: "vavg", label: "Media", kind: "volt" },
    { key: "vmax", label: "Massima", kind: "volt" },
    { key: "cuts", label: "Interruzioni", kind: "int" },
    { key: "cutS", label: "Senza alimentazione", kind: "dur" },
    { key: "last", label: "Ultimo valore", kind: "volt" },
  ];
  const summary: Row[] = [];
  const events: Row[] = [];
  for (const { v, pts } of await tracks(ctx, from, to)) {
    const vs = pts.filter((p) => typeof p.voltage === "number");
    if (!vs.length) { summary.push({ vehicle: v.name, vmin: null, vavg: null, vmax: null, cuts: null, cutS: null, last: null }); continue; }
    const vals = vs.map((p) => p.voltage as number);
    let cuts = 0, cutS = 0, startIdx = -1;
    vs.forEach((p, i) => {
      const low = (p.voltage as number) < LOW;
      if (low && startIdx < 0) { startIdx = i; cuts++; }
      if ((!low || i === vs.length - 1) && startIdx >= 0) {
        const a = vs[startIdx];
        cutS += p.ts - a.ts;
        // se è ancora senza alimentazione all'ultimo messaggio, la fine resta vuota
        events.push({ vehicle: v.name, start: a.ts, end: low ? null : p.ts, dur: p.ts - a.ts, where: place(a) });
        startIdx = -1;
      }
    });
    summary.push({
      vehicle: v.name, vmin: Math.min(...vals), vavg: vals.reduce((s, x) => s + x, 0) / vals.length,
      vmax: Math.max(...vals), cuts, cutS, last: vals[vals.length - 1],
    });
  }
  const groups: Group[] = [{ title: "Riepilogo", rows: summary }];
  if (events.length) {
    groups.push({
      title: "Interruzioni di alimentazione",
      subtitle: "Periodi con tensione esterna sotto 6 V: dispositivo scollegato o batteria del veicolo staccata.",
      rows: events.map((e) => ({ vehicle: e.vehicle, cutS: e.dur, start: e.start, end: e.end, where: e.where })),
    });
  }
  return {
    columns: [...columns, { key: "start", label: "Inizio", kind: "datetime" }, { key: "end", label: "Fine", kind: "datetime" }, { key: "where", label: "Luogo", kind: "address" }],
    groups,
    notes: summary.some((r) => r.vmin == null) ? ["Alcuni dispositivi non inviano la tensione di alimentazione (external.powersource.voltage)."] : undefined,
  };
}

async function riepilogoVeicoli(ctx: Ctx): Promise<ReportResult> {
  const [from, to] = period(ctx.input);
  const columns: Column[] = [
    { key: "vehicle", label: "Veicolo", kind: "text" },
    { key: "km", label: "Distanza", kind: "km" },
    { key: "odoStart", label: "Contachilometri inizio", kind: "km", optional: true },
    { key: "odoEnd", label: "Contachilometri fine", kind: "km", optional: true },
    { key: "fuel", label: "Carburante consumato", kind: "liters" },
    { key: "vmax", label: "Velocità massima", kind: "speed" },
    { key: "drive", label: "Tempo di guida", kind: "dur" },
    { key: "stops", label: "Fermate", kind: "int" },
    { key: "park", label: "Tempo di sosta", kind: "dur" },
  ];
  const rows: Row[] = [];
  for (const { v, pts } of await tracks(ctx, from, to)) {
    const { items, summary: s } = buildTimeline(pts, from, to);
    const stops = items.filter((i) => i.kind === "stop").length;
    rows.push({
      vehicle: v.name, km: pts.length ? s.km : null, odoStart: s.odoStart, odoEnd: s.odoEnd, fuel: s.fuelUsed,
      vmax: s.maxSpeed || null, drive: s.movingS, stops: Math.max(0, stops - (items[0]?.kind === "stop" ? 1 : 0)), park: s.stoppedS,
    });
  }
  return {
    columns, groups: [{ title: "", rows }],
    totals: { vehicle: "Totale", km: sum(rows, "km"), fuel: sum(rows, "fuel") || null, vmax: maxOf(rows, "vmax"), drive: sum(rows, "drive"), stops: sum(rows, "stops"), park: sum(rows, "park") },
  };
}

async function riepilogoGiorni(ctx: Ctx): Promise<ReportResult> {
  const [from, to] = period(ctx.input);
  const columns: Column[] = [
    { key: "date", label: "Data", kind: "date" },
    { key: "km", label: "Distanza", kind: "km" },
    { key: "drive", label: "Tempo di guida", kind: "dur" },
    { key: "park", label: "Tempo di sosta", kind: "dur" },
    { key: "vmax", label: "Velocità massima", kind: "speed" },
    { key: "fuel", label: "Carburante consumato", kind: "liters" },
    { key: "odoStart", label: "Contachilometri inizio", kind: "km", optional: true },
    { key: "odoEnd", label: "Contachilometri fine", kind: "km", optional: true },
  ];
  const groups: Group[] = [];
  for (const { v, pts } of await tracks(ctx, from, to)) {
    const rows: Row[] = days(from, to).map(([a, b]) => {
      const { summary: s } = buildTimeline(pts.filter((p) => p.ts >= a && p.ts <= b), a, b);
      return { date: a, km: s.km, drive: s.movingS, park: s.stoppedS, vmax: s.maxSpeed || null, fuel: s.fuelUsed, odoStart: s.odoStart, odoEnd: s.odoEnd };
    });
    groups.push({ title: v.name, rows, totals: { km: sum(rows, "km"), drive: sum(rows, "drive"), park: sum(rows, "park"), vmax: maxOf(rows, "vmax"), fuel: sum(rows, "fuel") || null } });
  }
  return { columns, groups };
}

async function eccessoVelocita(ctx: Ctx): Promise<ReportResult> {
  const [from, to] = period(ctx.input);
  const limit = ctx.input.speedLimit && ctx.input.speedLimit > 0 ? ctx.input.speedLimit : 130;
  const ok = inWindow(ctx.input);
  const MIN_S = 10;
  const columns: Column[] = [
    { key: "start", label: "Dalle", kind: "datetime" },
    { key: "end", label: "Alle", kind: "time" },
    { key: "dur", label: "Durata", kind: "dur" },
    { key: "km", label: "Distanza", kind: "km" },
    { key: "over", label: "Superamento medio", kind: "speed" },
    { key: "vmax", label: "Velocità massima", kind: "speed" },
    { key: "limit", label: "Limite", kind: "speed" },
    { key: "fromPlace", label: "Inizio", kind: "address" },
    { key: "toPlace", label: "Fine", kind: "address", optional: true },
  ];
  const groups: Group[] = [];
  for (const { v, pts } of await tracks(ctx, from, to)) {
    const rows: Row[] = [];
    const lim = v.speedLimit ?? limit; // il limite impostato nell'anagrafica del veicolo ha la precedenza
    let seg: TrackPoint[] = [];
    const flush = () => {
      if (seg.length >= 2 && seg[seg.length - 1].ts - seg[0].ts >= MIN_S && ok(seg[0].ts)) {
        let km = 0;
        for (let i = 1; i < seg.length; i++) km += haversineKm([seg[i - 1].lat, seg[i - 1].lon], [seg[i].lat, seg[i].lon]);
        const sp = seg.map((p) => p.speed ?? 0);
        rows.push({
          start: seg[0].ts, end: seg[seg.length - 1].ts, dur: seg[seg.length - 1].ts - seg[0].ts, km,
          over: sp.reduce((s, x) => s + x, 0) / sp.length - lim, vmax: Math.max(...sp), limit: lim,
          fromPlace: place(seg[0]), toPlace: place(seg[seg.length - 1]),
        });
      }
      seg = [];
    };
    for (const p of pts) {
      const fast = (p.speed ?? 0) > lim;
      if (fast && seg.length && p.ts - seg[seg.length - 1].ts > 120) flush();
      if (fast) seg.push(p); else if (seg.length) flush();
    }
    flush();
    if (rows.length) groups.push({ title: v.name, rows, totals: { dur: sum(rows, "dur"), km: sum(rows, "km"), vmax: maxOf(rows, "vmax") } });
  }
  return { columns, groups, notes: [`Limite generale: ${limit} km/h; per i veicoli con un limite nell'anagrafica si usa quello. Sono contati i superamenti di almeno ${MIN_S} secondi.`] };
}

const RUNNERS: Record<string, (ctx: Ctx) => Promise<ReportResult>> = {
  "itinerari": itinerari,
  "mensile-km": (c) => monthly(c, "km"),
  "mensile-ore": (c) => monthly(c, "hours"),
  "ore-motore": (c) => monthly(c, "ignition"),
  "gps-vs-can": gpsVsCan,
  "fermate": fermate,
  "coordinate": coordinate,
  "posizionamento": posizionamento,
  "tensione": tensione,
  "riepilogo-veicoli": riepilogoVeicoli,
  "riepilogo-giorni": riepilogoGiorni,
  "eccesso-velocita": eccessoVelocita,
};

export async function runReport(id: string, scope: Scope, input: ReportInput): Promise<ReportResult> {
  const run = RUNNERS[id];
  if (!run) throw new ReportError("Questo report non è ancora disponibile.");
  const visible = await fleet.listVehicles(scope);
  const wanted = input.vehicleIds?.length ? new Set(input.vehicleIds) : null;
  const vehicles = visible.filter((v) => !wanted || wanted.has(v.id));
  if (!vehicles.length) throw new ReportError("Scegli almeno un veicolo.");
  return run({ scope, input, vehicles });
}

export { dateLabel };
