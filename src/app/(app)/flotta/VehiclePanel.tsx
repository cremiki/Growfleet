"use client";

import { useEffect, useMemo, useState } from "react";
import type { TelemetryEntry, VehicleState } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { fmt1, fmtInt, fmtTime, STATUS_COLOR } from "@/lib/format";
import { buildTimeline, type TimelineItem } from "@/lib/trips";
import { startOfDay, useTrack } from "@/lib/useTrack";
import { useAddresses } from "@/lib/useAddresses";
import { formatParam, PARAM_LABELS } from "@/lib/paramLabels";
import type { Focus, RouteOverlay } from "@/components/map";
import { StatusIcon } from "./StatusIcon";

type Props = {
  vehicle: VehicleState;
  tab: "now" | "routes";
  onTab: (t: "now" | "routes") => void;
  customerName?: string;
  onBack: () => void;
  onRoute: (r: RouteOverlay | null) => void;
  onFocus: (f: Focus) => void;
};

/** "4H 11min", "18H 41min", "6min" */
export function dur(sec: number) {
  const m = Math.max(0, Math.round(sec / 60));
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}H ${m % 60}min`;
  return `${Math.floor(h / 24)}G ${h % 24}H`;
}

export function VehiclePanel({ vehicle: v, tab, onTab, customerName, onBack, onRoute, onFocus }: Props) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 pt-2.5">
        <button type="button" onClick={onBack} className="text-sign font-medium text-sm hover:underline">‹ Torna alla flotta</button>
      </div>
      <div className="grid grid-cols-2 border-b border-line mt-1" role="tablist">
        {([["now", "Adesso"], ["routes", "Itinerari"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => onTab(k)}
            className={`py-2.5 text-sm font-medium border-b-[3px] ${tab === k ? "border-sign text-sign" : "border-transparent text-muted hover:text-ink"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "now"
          ? <NowTab v={v} customerName={customerName} onFocus={onFocus} />
          : <RoutesTab v={v} onRoute={onRoute} onFocus={onFocus} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Adesso */

function NowTab({ v, customerName, onFocus }: { v: VehicleState; customerName?: string; onFocus: (f: Focus) => void }) {
  const [from] = useState(() => startOfDay(Date.now() / 1000) - 86400); // da ieri, per sapere da quanto è fermo
  const { points } = useTrack(v.id, from, 0, 60_000);
  const address = useAddresses([v]);
  const [tel, setTel] = useState<TelemetryEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/vehicles/${v.id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (alive && b) setTel(b.telemetry); });
    return () => { alive = false; };
  }, [v.id, v.lastSeen]);

  const now = Date.now() / 1000;
  const today = useMemo(() => (points ? buildTimeline(points, startOfDay(now), now).summary : null), [points]); // eslint-disable-line react-hooks/exhaustive-deps
  const since = useMemo(() => {
    if (!points) return null;
    const items = buildTimeline(points, from, now).items;
    return items.length ? items[items.length - 1].start : null;
  }, [points]); // eslint-disable-line react-hooks/exhaustive-deps

  const addr = address(v.lat, v.lon);
  const showGps = v.gpsMileage != null && v.gpsMileage !== v.odometerKm;
  const fuelUsedToday = today?.fuelUsed;

  return (
    <div className="text-[14px]">
      <section className="px-3 py-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <StatusIcon status={v.status} course={v.course} type={v.vtype} />
          <h2 className="plate text-xl font-bold leading-tight">{v.name}</h2>
          {v.makeModel && <span className="text-muted">{v.makeModel}</span>}
        </div>
        <p className="font-medium" style={{ color: STATUS_COLOR[v.status] }}>
          {STATUS_LABEL[v.status]}
          <span className="text-[11px] border border-line rounded px-1 mx-1.5 text-muted align-middle">{fmtInt(v.speed ?? 0)} km/h</span>
          {since && v.status !== "offline" && v.status !== "nodata" && <span className="text-muted">({dur(now - since)})</span>}
        </p>
        {customerName && <Row icon="customer">{customerName}</Row>}
        {v.driver && <Row icon="customer">Autista: {v.driver}</Row>}
        {v.lat != null && (
          <>
            <Row icon="pin">{addr ?? <span className="text-muted">ricerca indirizzo…</span>}</Row>
            <Row icon="target">
              <button type="button" className="hover:underline" onClick={() => onFocus({ lat: v.lat!, lon: v.lon!, zoom: 17, key: `v${v.id}${Date.now()}` })}>
                {v.lat.toFixed(5)}, {v.lon!.toFixed(5)}
              </button>
            </Row>
          </>
        )}
        {v.externalV != null && <Row icon="battery">{fmt1(v.externalV)} V</Row>}
        {(v.odometerKm != null || v.engineHours != null) && (
          <Row icon="gauge">
            {v.odometerKm != null && <>{fmtInt(v.odometerKm)} km{showGps ? ` / ${fmt1(v.gpsMileage)} km GPS` : ""}</>}
            {v.engineHours != null && <span className="block">{fmtInt(v.engineHours)} h motore</span>}
          </Row>
        )}
        <p className="flex gap-4 text-sm">
          <a href={`/veicoli/${v.id}`} className="text-sign hover:underline">Profilo del veicolo</a>
          {v.lat != null && (
            <a href={`https://www.google.com/maps?q=${v.lat},${v.lon}`} target="_blank" rel="noreferrer" className="text-sign hover:underline">
              Apri in Google Maps
            </a>
          )}
        </p>
      </section>

      <section className="border-t border-line px-3 py-3">
        <p className="text-center text-xs text-muted">Oggi {fmtTime(now)}</p>
        <div className="grid grid-cols-3 text-center mt-2">
          <Stat value={today ? `${fmt1(today.km)}` : "…"} unit="km" label="Distanza" />
          <Stat value={today ? dur(today.movingS) : "…"} label="In movimento" />
          <Stat value={today ? dur(today.stoppedS) : "…"} label="Fermi" />
        </div>
      </section>

      {(v.fuelLevel != null || v.fuelVolume != null || v.fuelUsed != null) && (
        <section className="border-t border-line px-3 py-3">
          <h3 className="text-xs font-semibold text-muted">Carburante</h3>
          {v.fuelLevel != null && (
            <div className="mt-2">
              <div className="flex justify-between text-sm">
                <span>Livello serbatoio</span>
                <span className="font-semibold">{fmtInt(v.fuelLevel)}%{v.fuelVolume != null ? ` (${fmt1(v.fuelVolume)} l)` : ""}</span>
              </div>
              <div className="h-1.5 bg-asphalt rounded-full mt-1 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, v.fuelLevel))}%`, background: v.fuelLevel < 15 ? "#b3261e" : v.fuelLevel < 30 ? "#c98f00" : "#0a7a45" }} />
              </div>
            </div>
          )}
          {v.fuelLevel == null && v.fuelVolume != null && <KV k="Nel serbatoio" v={`${fmt1(v.fuelVolume)} l`} />}
          {fuelUsedToday != null && <KV k="Consumato oggi" v={`${fmt1(fuelUsedToday)} l`} />}
          {v.fuelUsed != null && <KV k="Totale consumato (CAN)" v={`${fmt1(v.fuelUsed)} l`} />}
        </section>
      )}

      <section className="border-t border-line px-3 py-3">
        <h3 className="text-xs font-semibold text-muted">Altri dati</h3>
        {!tel ? <p className="text-muted text-sm mt-2">Caricamento…</p> : <OtherData tel={tel} />}
      </section>
    </div>
  );
}

const SHOWN_ABOVE = new Set(["position.latitude", "position.longitude", "position.speed", "position.direction", "timestamp", "server.timestamp", "ident", "device.id", "device.name", "device.type.id", "channel.id", "protocol.id", "peer"]);

function OtherData({ tel }: { tel: TelemetryEntry[] }) {
  const [all, setAll] = useState(false);
  const known = tel.filter((t) => PARAM_LABELS[t.name] && !SHOWN_ABOVE.has(t.name));
  const rest = tel.filter((t) => !PARAM_LABELS[t.name] && !SHOWN_ABOVE.has(t.name));
  return (
    <>
      <dl className="mt-1.5">
        {known.map((t) => <KV key={t.name} k={PARAM_LABELS[t.name][0]} v={formatParam(t.name, t.value)} title={t.name} />)}
        {all && rest.map((t) => <KV key={t.name} k={t.name} v={formatParam(t.name, t.value)} mono />)}
      </dl>
      {rest.length > 0 && (
        <button type="button" onClick={() => setAll(!all)} className="mt-2 text-sign text-sm hover:underline">
          {all ? "Nascondi i parametri tecnici" : `Mostra tutti i parametri (${rest.length} in più)`}
        </button>
      )}
    </>
  );
}

function KV({ k, v, title, mono }: { k: string; v: string; title?: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm border-b border-line/60 last:border-0" title={title}>
      <dt className={`text-muted ${mono ? "break-all text-xs" : ""}`}>{k}</dt>
      <dd className="text-right break-all">{v}</dd>
    </div>
  );
}

function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div>
      <p className="plate text-xl font-semibold">{value}{unit && <span className="text-sm font-normal"> {unit}</span>}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

const ROW_ICONS: Record<string, string> = {
  pin: "M10 2a6 6 0 0 1 6 6c0 4.5-6 10-6 10S4 12.5 4 8a6 6 0 0 1 6-6Zm0 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
  target: "M10 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z",
  battery: "M3 6h12v2h2v4h-2v2H3V6Zm2 2v4h8V8H5Z",
  gauge: "M10 4a8 8 0 0 1 8 8h-2a6 6 0 0 0-12 0H2a8 8 0 0 1 8-8Zm3.5 3.1 1.4 1.4-3.6 3.6a1.5 1.5 0 1 1-1.4-1.4l3.6-3.6Z",
  customer: "M10 10a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm-6 7c0-3 2.7-5 6-5s6 2 6 5v1H4v-1Z",
};

function Row({ icon, children }: { icon: keyof typeof ROW_ICONS; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <svg viewBox="0 0 20 20" className="size-4 mt-0.5 shrink-0 text-muted" fill="currentColor" aria-hidden><path d={ROW_ICONS[icon]} /></svg>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* --------------------------------------------------------------- Itinerari */

const toInputDate = (ts: number) => {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fromInputDate = (s: string) => Math.floor(new Date(`${s}T00:00:00`).getTime() / 1000);

function RoutesTab({ v, onRoute, onFocus }: { v: VehicleState; onRoute: (r: RouteOverlay | null) => void; onFocus: (f: Focus) => void }) {
  const todayStart = startOfDay(Date.now() / 1000);
  const [day, setDay] = useState(todayStart);
  const to = Math.min(day + 86400, Math.floor(Date.now() / 1000));
  const { points, error } = useTrack(v.id, day, day === todayStart ? to : day + 86400);
  const [active, setActive] = useState<number | null>(null);

  const timeline = useMemo(() => (points ? buildTimeline(points, day, day === todayStart ? Math.floor(Date.now() / 1000) : day + 86400) : null), [points]); // eslint-disable-line react-hooks/exhaustive-deps
  const stops = timeline?.items.filter((i): i is Extract<TimelineItem, { kind: "stop" }> => i.kind === "stop") ?? [];
  const address = useAddresses(stops);

  useEffect(() => { setActive(null); }, [day]);
  useEffect(() => {
    if (!points || !timeline) { onRoute(null); return; }
    const item = active != null ? timeline.items[active] : null;
    onRoute({
      key: `${v.id}-${day}-${points.length}`,
      points,
      stops,
      highlight: item?.kind === "trip" ? [item.startIdx, item.endIdx] : null,
    });
  }, [points, timeline, active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onRoute(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (i: number) => {
    setActive(i);
    const it = timeline!.items[i];
    if (it.kind === "stop") onFocus({ lat: it.lat, lon: it.lon, zoom: 16, key: `stop${i}${Date.now()}` });
  };
  const s = timeline?.summary;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 flex items-center gap-1.5 border-b border-line">
        <input type="date" value={toInputDate(day)} max={toInputDate(todayStart)} aria-label="Giorno"
          onChange={(e) => e.target.value && setDay(fromInputDate(e.target.value))}
          className="flex-1 border border-line rounded px-2 py-1 bg-white text-sm" />
        <button type="button" aria-label="Giorno precedente" onClick={() => setDay(startOfDay(day - 43200))}
          className="border border-line rounded size-8 hover:bg-asphalt">‹</button>
        <button type="button" aria-label="Giorno successivo" disabled={day >= todayStart} onClick={() => setDay(startOfDay(day + 129600))}
          className="border border-line rounded size-8 hover:bg-asphalt disabled:opacity-40">›</button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {error && <p className="p-3 text-offline text-sm">{error}</p>}
        {!points && !error && <p className="p-3 text-muted text-sm">Caricamento del percorso…</p>}
        {timeline && timeline.items.length === 0 && (
          <div className="p-4 text-sm text-muted leading-relaxed">
            <p className="font-semibold text-ink">Nessun dato in questo giorno</p>
            <p className="mt-1">Il dispositivo non ha inviato posizioni, oppure flespi non conserva i suoi messaggi.</p>
          </div>
        )}
        <ol>
          {timeline?.items.map((it, i) => (
            <li key={i}>
              <button type="button" onClick={() => pick(i)} aria-pressed={active === i}
                className={`w-full text-left flex gap-2.5 px-3 py-2 border-b border-line/60 ${active === i ? "bg-sign/10" : "hover:bg-asphalt/50"}`}>
                {it.kind === "stop" ? (
                  <>
                    <span className="mt-0.5 size-5 shrink-0 rounded-[3px] bg-[#2f80ed] text-white text-xs font-bold flex items-center justify-center">{it.n}</span>
                    <span className="flex-1 min-w-0 text-[13px]">
                      <span className="block">{address(it.lat, it.lon) ?? `${it.lat.toFixed(5)}, ${it.lon.toFixed(5)}`}</span>
                      <span className="text-muted">{fmtTime(it.start)} – {fmtTime(it.end)}</span>
                    </span>
                    <span className="text-[13px] font-medium whitespace-nowrap">{dur(it.end - it.start)}</span>
                  </>
                ) : (
                  <>
                    <span className="mt-0.5 size-5 shrink-0 rounded-[3px] bg-moving text-white flex items-center justify-center" aria-hidden>
                      <svg viewBox="0 0 12 12" className="size-3"><path d="M6 1l4 9-4-2-4 2z" fill="currentColor" /></svg>
                    </span>
                    <span className="flex-1 min-w-0 text-[13px]">
                      <span className="block font-semibold">{fmt1(it.km)} km</span>
                      <span className="text-muted">{fmtTime(it.start)} – {fmtTime(it.end)}, max {fmtInt(it.maxSpeed)} km/h</span>
                    </span>
                    <span className="text-[13px] font-medium whitespace-nowrap">{dur(it.end - it.start)}</span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ol>
      </div>

      {s && timeline!.items.length > 0 && (
        <section className="border-t border-line bg-asphalt/40 px-3 py-2.5 text-[13px]">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Riepilogo</h3>
            {active != null && <button type="button" onClick={() => setActive(null)} className="text-sign hover:underline">Percorso completo</button>}
          </div>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <dt className="text-muted">Distanza</dt>
            <dd className="text-right">
              {s.odoStart != null && s.odoEnd != null && s.odoEnd >= s.odoStart ? `${fmt1(s.odoEnd - s.odoStart)} km / ` : ""}{fmt1(s.km)} km GPS
            </dd>
            <dt className="text-muted">In movimento</dt><dd className="text-right">{dur(s.movingS)}</dd>
            <dt className="text-muted">Fermi</dt><dd className="text-right">{dur(s.stoppedS)}</dd>
            <dt className="text-muted">Velocità massima</dt><dd className="text-right">{fmtInt(s.maxSpeed)} km/h</dd>
            {s.fuelUsed != null && (
              <>
                <dt className="text-muted">Carburante consumato</dt>
                <dd className="text-right">{fmt1(s.fuelUsed)} l{s.km > 1 ? ` (${fmt1((s.fuelUsed / s.km) * 100)} l/100km)` : ""}</dd>
              </>
            )}
            <dt className="text-muted">Inizio contachilometri</dt><dd className="text-right">{s.odoStart != null ? `${fmt1(s.odoStart)} km` : "—"}</dd>
            <dt className="text-muted">Fine contachilometri</dt><dd className="text-right">{s.odoEnd != null ? `${fmt1(s.odoEnd)} km` : "—"}</dd>
          </dl>
        </section>
      )}
    </div>
  );
}
